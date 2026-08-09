# Documentation technique — comment l'agent IA WhatsApp + le tableau de bord ont été construits (Harmonie Yacht)

> Ce fichier documente **ce qui a réellement été construit**, étape par étape,
> avec les vrais noms de tables, fonctions et outils. C'est un retour
> d'expérience/étude de cas — à ne pas confondre avec
> `guide-agent-ia-whatsapp-pme.md`, qui lui est le brief qu'on donne à Claude
> Code pour démarrer un NOUVEAU projet chez un autre client.

## 1. Vue d'ensemble de l'architecture

```
Client (WhatsApp) ⇄ Service Baileys (Railway) ⇄ Supabase (DB + Edge Functions)
                                                        │
                                              Edge Function "agent-lea"
                                                        │
                                                  Claude API (Anthropic)

Robin (Telegram) ⇄ Edge Function "telegram-manager" ⇄ Supabase ⇄ Claude API
Robin (voix, dashboard) ⇄ Edge Function "dashboard-agent" ⇄ Supabase ⇄ Claude API

Dashboard Next.js (Vercel) ⇄ Supabase (lecture/écriture directe + les 2 agents ci-dessus)

Google Calendar ⇄ Edge Functions "sync-gcal" / "import-gcal-bookings" ⇄ Supabase
```

Deux "cerveaux" IA distincts, qui ne se parlent jamais directement — seulement
via la base de données commune :
- **Léa** (`agent-lea`) : parle aux clients sur WhatsApp.
- **Manager** (`_shared/manager-agent.ts`, utilisé par `telegram-manager` et
  `dashboard-agent`) : parle à Robin, en langage naturel, sur Telegram ou en
  vocal (Jarvis) depuis le dashboard.

## 2. Les comptes créés, dans l'ordre où on en a eu besoin

1. **Supabase** — projet Postgres + Edge Functions (le cœur de tout).
2. **Anthropic** — clé API Claude, utilisée par les deux agents.
3. **Vercel** — hébergement du dashboard Next.js.
4. **Railway** — hébergement du service Baileys (doit tourner en continu,
   contrairement au dashboard qui ne se réveille qu'à la demande).
5. **Un numéro de téléphone dédié** (carte SIM/eSIM séparée) avec WhatsApp
   installé dessus — jamais le numéro perso du patron.
6. **Telegram** — un bot créé via @BotFather, pour le canal manager.
7. **Google Cloud** — un compte de service (service account) avec accès à un
   Google Calendar, pour la synchro réservations.
8. *(non utilisé ici mais évalué)* Meta Business — pour l'API WhatsApp
   officielle, écartée au profit de Baileys pour des raisons de coût/volume.

## 3. Étape 1 — Le projet Supabase

### Tables principales (schéma réel)
| Table | Rôle |
|---|---|
| `leads` | Prospects : contact, canal source, offre visée, score, statut de pipeline (`new → contacted → qualified → quote_sent → followed_up → booked/lost`) |
| `conversations` | Historique des échanges par lead (contexte mémoire de Léa) |
| `bookings` | Réservations réelles confirmées — jamais mélangées avec les intentions des leads |
| `revenues` | Encaissements, scindés en lignes `payment_kind` = `deposit`/`balance`, datés par événement réel |
| `expenses` | Dépenses, ajoutées/supprimées via le manager |
| `customers` | Clients ayant déjà réservé au moins une fois |
| `agent_config` | Offres, tarifs, FAQ — relu par Léa à chaque conversation, jamais codé en dur dans le prompt |
| `agent_config_pending_changes` / `agent_config_history` | Changements de config proposés par le manager, en attente de confirmation explicite de Robin, puis historisés |
| `wa_conversations` / `wa_messages` | Inbox WhatsApp brute (tous les messages, humains et Léa) |
| `wa_auth_state` | Session Baileys persistée (évite de rescanner le QR à chaque redémarrage) |
| `events_public` / `event_bookings` | Événements ponctuels (soirées, sorties spéciales) |
| `blocked_dates` / `weather_cache` | Disponibilité et météo marine (Open-Meteo) |
| `goals` / `referrals` / `content_marketing` / `ad_stats` | Suivi objectifs, parrainage, marketing |
| `telegram_manager_conversations` | Mémoire de fil de discussion du bot Telegram |

### Edge Functions déployées
| Fonction | Rôle |
|---|---|
| `agent-lea` | Le cerveau client — reçoit un message WhatsApp, répond via Claude + outils |
| `whatsapp-webhook` | Point d'entrée si un jour bascule sur l'API officielle Meta |
| `telegram-manager` | Le manager côté bot Telegram |
| `dashboard-agent` | Le manager côté vocal (Jarvis), appelé depuis le dashboard |
| `lea-followups` | Cron qui relance les leads inactifs |
| `sync-gcal` | Pousse une réservation créée dans le dashboard vers Google Calendar |
| `import-gcal-bookings` | Lit les events du calendrier (venant du site public) et crée les `bookings` correspondants |
| `gcal-list` | Liste les events pour l'affichage disponibilité |
| `booking-form-webhook` | Réception d'un formulaire de réservation externe |
| `email-webhook` | Réception d'emails entrants |
| `_shared` | Code commun (le manager-agent, le client Google Calendar, etc.) — pas une fonction déployée, une librairie |

## 4. Étape 2 — L'agent IA client (Léa)

Prompt structuré en **11 sections numérotées** dans `agent-lea/index.ts`
(identité/ton, format des messages, exemples de ton réel, anti-répétition,
mémoire, qualification du prospect, offres/tarifs, disponibilité, escalade
humaine, interdits, règles d'utilisation des outils) — jamais un prompt
monolithique, pour pouvoir corriger une règle sans toucher aux dix autres.

### Ses outils (tool use)
| Outil | Rôle |
|---|---|
| `qualify_lead` | Enregistre les infos de qualification (nuit/sortie, date, budget…) |
| `update_lead_status` | Fait avancer le pipeline — **`"booked"` a été retiré de son enum possible** (voir §9) |
| `create_lead` | Crée une fiche prospect si elle n'existe pas |
| `escalate_to_human` | Bascule vers Robin sur les cas hors périmètre |
| `get_active_events` | Consulte les événements ponctuels en cours |
| `check_availability` | Vérifie les disponibilités réelles |
| `send_booking_link` | Envoie le lien de réservation (site) une fois la qualification faite |

Ordre de qualification imposé dans le prompt : **nuit à bord ou sortie en
mer ? → date en tête ? → seulement ensuite le lien du site.** Cet ordre a
été ajusté après avoir vu Léa se tromper en pratique (voir §9) — c'est un
choix métier du client, validé avec de vrais échanges, pas décidé en théorie.

## 5. Étape 3 — Connecter WhatsApp (le service Baileys)

Baileys pilote WhatsApp comme "WhatsApp Web" — pas d'API payante Meta, mais
pas de garantie officielle non plus.

**Le service** (`baileys-service/`, Node.js + Express, déployé sur Railway
via Docker) :
1. Démarre sans session → Baileys génère un QR code.
2. Le dashboard (page `/agent`) interroge l'endpoint `GET /qr` du service et
   affiche le QR à l'écran.
3. Robin scanne ce QR **avec l'appli WhatsApp du numéro dédié**
   (Réglages → Appareils connectés → Lier un appareil).
4. Une fois lié, les identifiants de session sont écrits dans la table
   Supabase `wa_auth_state` — le service peut redémarrer sur Railway sans
   jamais redemander de scan.
5. Si Robin déconnecte l'appareil depuis son téléphone, le service détecte le
   `loggedOut`, vide `wa_auth_state` et régénère un nouveau QR automatiquement.
6. Chaque message entrant est sauvegardé dans `wa_messages`, puis transmis à
   Léa (sauf si la conversation est en pause — un humain a répondu à la main
   dans les dernières 24h, détecté via les messages `fromMe`).
7. La réponse de Léa est envoyée avec un délai simulé (indicateur "écrit…" +
   délai proportionnel à la longueur du message) pour éviter l'effet robot.

Endpoints exposés par le service : `/health`, `/qr`, `/pause/:phone`,
`/resume/:phone`, `/send` (réponse manuelle depuis l'inbox du dashboard).

## 6. Étape 4 — Le tableau de bord (Next.js sur Vercel)

Pages principales : `/leads` (pipeline + score), `/bookings` (réservations),
`/finances` (revenus/dépenses), `/marketing`, `/resultats`, `/events`,
`/reports`, `/contrats`, `/settings`, `/agent` (inbox WhatsApp manuelle,
via les routes `app/api/wa/*` qui parlent au service Railway), `/jarvis`
(interface vocale 3D pour parler au manager en langage naturel).

Une notification "leads chauds" apparaît en haut de la page d'accueil dès
qu'un prospect a un score élevé et n'est ni booké ni perdu — pour ne jamais
en rater un noyé dans la liste.

## 7. Étape 5 — L'agent manager (côté patron)

Deux canaux, un seul cerveau partagé (`_shared/manager-agent.ts`) :
- **Telegram** (`telegram-manager`) — rapide, gratuit, notifications.
- **Jarvis** (`dashboard-agent`) — vocal, orbe 3D dans le dashboard, boucle
  mains-libres (reconnaissance vocale + synthèse vocale navigateur).

### Ses outils
`get_business_stats`, `list_interested_leads`, `list_upcoming_bookings`,
`send_whatsapp_followup`, `get_agent_config`, `propose_config_change`,
`confirm_pending_change`, `cancel_pending_change`, `add_expense`,
`list_expenses`, `delete_expense`, `get_marketing_performance`.

Point important : **changer la config (tarifs, offres) passe par un
propose → confirm explicite** (`agent_config_pending_changes`), jamais une
écriture directe sur une simple phrase — Robin doit valider dans son message
suivant avant que le changement soit appliqué et historisé.

Accès : lecture totale sur la base, écriture seulement sur les outils listés
ci-dessus (ex. dépenses) — jamais un accès libre à tout modifier.

## 8. Étape 6 — Intégrations annexes

- **Google Calendar** : `sync-gcal` pousse les réservations créées dans le
  dashboard vers un calendrier ; `import-gcal-bookings` lit dans l'autre sens
  les événements créés par le site public (qui suit un format texte strict
  dans la description : Client/Email/Téléphone/Durée/Invités/Demandes/Prix
  total/Acompte payé) et crée les `bookings` correspondants. Le calendrier
  est le SEUL point d'intégration entre le site public (Lovable) et cette
  base — indépendant du moyen de paiement utilisé sur le site.
- **`lea-followups`** : cron qui relance automatiquement les leads inactifs
  depuis un certain temps.
- **`email-webhook`** : réception d'emails entrants comme canal secondaire.

## 9. Pièges réels rencontrés (et comment ils ont été corrigés)

1. **Confirmations hallucinées.** Le manager disait parfois "dépense
   enregistrée" sans que l'outil ait réellement réussi. → règle explicite
   dans le prompt ("ne confirme qu'après un tool_result réel de ce tour")
   + `delete_expense` ajouté pour pouvoir corriger une erreur, puisqu'il
   n'existait au départ qu'un moyen d'ajouter, jamais de supprimer.
2. **Léa s'auto-attribuait le statut "réservé".** Un client qui disait "je
   réserve de suite" suffisait pour que Léa marque le lead `booked`, alors
   qu'aucun paiement n'était confirmé. → `"booked"` retiré de l'enum de
   l'outil `update_lead_status`, refus explicite ajouté côté serveur en
   filet de sécurité, et règle ajoutée au prompt.
3. **Ordre de qualification inversé par erreur.** Léa envoyait le lien du
   site avant même de savoir si le client voulait une nuit ou une sortie en
   mer. → prompt réécrit pour imposer l'ordre nuit/sortie → date → site,
   dans cet ordre précis, jamais sauté ni inversé.
4. **Build Vercel silencieusement obsolète.** Une erreur ESLint
   (`no-explicit-any`) faisait échouer le build sans que l'ancienne version
   soit remplacée — la nouvelle page Jarvis n'apparaissait jamais en
   production. → toujours vérifier `npm run build` en local avant de
   pousser une nouvelle page.
5. **Synthèse vocale muette sur iOS Safari.** `speechSynthesis.speak()`
   appelé après un `fetch` (donc hors du geste utilisateur direct) était
   silencieusement ignoré par Safari. → un utterance vide est joué de façon
   synchrone dans le clic qui démarre la session, pour "débloquer" la voix.
6. **Erreurs de déploiement sur les gros fichiers.** Retaper de mémoire un
   commentaire d'en-tête dans un edge function volumineux a fait sauter un
   saut de ligne et cassé le bundling. → méthode systématique : récupérer le
   code déployé actuel, appliquer les modifications par remplacement de
   texte exact (jamais retaper), vérifier que le résultat correspond
   caractère pour caractère au fichier local avant de redéployer.

## 10. Budget réel (ordre de grandeur mensuel)

- Supabase : gratuit au démarrage, quelques dizaines d'€/mois en grandissant.
- Vercel (dashboard) : gratuit à quelques €/mois selon trafic.
- Railway (service Baileys, doit tourner 24/7) : quelques €/mois.
- Claude API : quelques centimes par conversation, facturé à l'usage.
- Numéro WhatsApp dédié (SIM/eSIM) : quelques €/mois.
- Telegram : gratuit.

## 11. Pour aller plus loin

- Paiement en ligne intégré avec synchronisation automatique vers le CRM.
- Documents/contrats générés automatiquement à la confirmation d'une
  réservation.
- Avis clients automatisés après chaque prestation.

---

*Documentation de l'infra réelle d'Harmonie Yacht — utile comme référence
pour expliquer/former sur l'architecture, en complément du fichier
`guide-agent-ia-whatsapp-pme.md` qui sert lui à démarrer un nouveau projet.*
