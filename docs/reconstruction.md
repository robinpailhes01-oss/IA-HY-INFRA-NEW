# Reconstruire Harmonie Yacht sur un nouveau projet Supabase

Pas à pas, dans l'ordre. Chaque étape dit **qui** la fait et **comment vérifier**.
Temps total : 2 à 3 heures, dont la moitié à ressaisir des clés.

## 0. Avant tout : la sauvegarde (toi, 5 min)

1. Ouvre `https://ia-hy-infra-new.vercel.app/sauvegarde`, connecte-toi.
2. **Créer la sauvegarde complète**, laisse la page ouverte jusqu'au téléchargement.
3. Vérifie le message de fin : « Toutes les tables sont complètes ». Mets le `.zip` en lieu sûr (jamais sur GitHub).
4. Optionnel mais utile : ouvre `https://ia-hy-infra-new.vercel.app/api/admin/backup/schema`, enregistre la page (Ctrl+S) : c'est le schéma réel, ça permet de vérifier la reconstruction.

## 1. Nouveau projet Supabase (toi, 10 min)

- Compte et organisation : **un compte que tu maîtrises**, dans une organisation dédiée « Harmonie Yacht ».
- Formule **Pro** conseillée (le gratuit met le projet en pause après 7 jours d'inactivité).
- Région : `West EU (Ireland)` ou `Paris`. Mot de passe de base : un long, à noter.
- Note : l'adresse `https://<identifiant>.supabase.co` et, dans **Project Settings → API Keys** :
  la clé **anon / publishable** et la clé **service_role / secret**. Ne les colle jamais dans une conversation.

## 2. La structure de la base (moi + toi, 5 min)

- Donne-moi l'**identifiant** du projet (les 20 caractères de l'adresse). Je te remets le SQL prêt à coller.
- Dans **SQL Editor** : colle tout, **Run**. Résultat attendu : `Success`, sans rouge.
- Ensuite, dans le même éditeur, ces 2 lignes (remplace par deux textes secrets de ton choix, longs, différents) :

  ```sql
  alter database postgres set app.cron_secret = 'UN_SECRET_LONG_A_TOI';
  select vault.update_secret((select id from vault.secrets where name = 'sync_gcal_secret'), 'UN_AUTRE_SECRET_LONG');
  ```
  Garde ces deux secrets : tu les remettras comme secrets des fonctions (étape 5).

## 3. Brancher le tableau de bord (toi, 10 min)

Dans Vercel → projet `ia-hy-infra-new` → **Settings → Environment Variables**, modifie (Production) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | l'adresse du nouveau projet |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé anon / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé service_role / secret |
| `HY_ENABLE_RESTORE` | `1` (à retirer après la restauration) |

Puis **Redeploy** (Deployments → ⋯ → Redeploy).

## 4. Premier compte, puis restauration (toi, 15 min)

1. Supabase → **Authentication → Users → Add user** : ton e-mail + un mot de passe, coche « Auto Confirm ». Le **premier** compte devient administrateur automatiquement.
2. Connecte-toi au tableau de bord avec ce compte (vide pour l'instant, c'est normal).
3. Va sur `/restauration`, choisis le `.zip`, vérifie la destination affichée, **Restaurer la sauvegarde**.
4. À la fin : lis le rapport. Idéal : « Restauration complète ». Sinon, télécharge le rapport et envoie-le-moi (il ne contient pas de données clients, seulement des identifiants de lignes et des messages d'erreur).
5. Retire `HY_ENABLE_RESTORE` de Vercel, redéploie.

Les mots de passe ne peuvent pas être récupérés : les autres personnes utilisent « mot de passe oublié » une fois.

## 5. Les fonctions de l'agent (moi + toi, 1 h)

Les 18 fonctions (`supabase/functions/*`) sont dans le dépôt. Elles se déploient depuis un ordinateur avec la CLI Supabase :

```bash
npm i -g supabase
supabase login
supabase link --project-ref <IDENTIFIANT>
supabase functions deploy --no-verify-jwt   # toutes (chacune vérifie elle-même son secret)
```

Chaque fonction lit ses clés dans **Edge Functions → Secrets**. Les clés de l'ancien projet sont perdues avec lui : il faut les rechercher chez chaque service.

| Fonction | Secrets à remettre |
|---|---|
| toutes | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (fournis automatiquement) |
| agent-lea, dashboard-agent, lea-followups, telegram-manager, email-webhook | `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`) |
| agent-lea, whatsapp-webhook | `LEA_SHARED_SECRET` (le même que dans Railway), `OWNER_PHONE`, `SITE_BOOKING_URL` |
| agent-lea, finance-pulse, weekly-report, telegram-manager | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID` |
| whatsapp-webhook, agent-lea, booking-form-webhook | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` (si l'API Meta est utilisée) |
| lea-followups, qonto-sync, sumup-sync, finance-pulse, weekly-report | `CRON_SECRET` (= `app.cron_secret` de l'étape 2) |
| qonto-sync | `QONTO_API_KEY` (`identifiant:clé`) |
| sumup-sync | `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE` |
| stripe-webhook | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (+ `_TEST`) |
| email-webhook, booking-form-webhook, stripe-webhook, import-gcal-bookings | `RESEND_API_KEY`, `RESEND_FROM`, `OWNER_EMAIL`, `EMAIL_WEBHOOK_SECRET` |
| booking-form-webhook | `BOOKING_WEBHOOK_SECRET`, `DASHBOARD_URL` |
| sync-gcal, gcal-list, import-gcal-bookings | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, `SYNC_GCAL_SECRET` (= le secret du vault de l'étape 2), `GCAL_IMPORT_SECRET` |
| dashboard-agent | `DASHBOARD_AGENT_SECRET` (aussi dans Vercel) |
| seo-audit | `SEO_AUDIT_SECRET`, `SEO_SITE_URL` |
| track-pageview | `TRACK_SALT`, `TRACK_ALLOWED_HOSTS` |
| dashboard-agent, lea-followups, telegram-manager, import-gcal-bookings | `BAILEYS_SERVICE_URL` (l'adresse du service Railway) |

Où retrouver ces valeurs : dans **Vercel** et **Railway** (variables du projet), dans les tableaux de bord de chaque service (Anthropic, Resend, Stripe, SumUp, Qonto, Telegram BotFather, Google Cloud), ou ton gestionnaire de mots de passe.

## 6. WhatsApp (l'agent Léa) : Railway + Baileys (toi, 20 min)

Le service `baileys-service` garde la session WhatsApp **dans la base** (table `wa_auth_state`). Sur Railway → le service → **Variables** :

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | adresse du nouveau projet |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role du nouveau projet |
| `LEA_SHARED_SECRET` | le même que dans les fonctions Supabase |

Puis **Redeploy**. Ensuite :

1. Si tu as restauré la session WhatsApp (case cochée à l'étape 4) : le service se reconnecte seul. Vérifie `https://<ton-service>.up.railway.app/health` : `connected: true`.
2. Sinon : ouvre le tableau de bord → **Agent WhatsApp**, scanne le **QR code** avec le téléphone de l'entreprise (WhatsApp → Appareils connectés). Si le QR n'apparaît pas, regarde `/health` : `waitingForQr: true`.
3. Si Railway est arrêté (crédit épuisé) : ajoute un moyen de paiement dans Railway, redémarre.
4. Dans Vercel, `BAILEYS_SERVICE_URL` doit être l'adresse publique du service.

## 7. Les autres branchements (toi, 30 min)

À refaire car ils pointent vers l'ancienne adresse :

- **Telegram** : `setWebhook` du bot vers `https://<IDENTIFIANT>.supabase.co/functions/v1/telegram-manager`.
- **Stripe** : Developers → Webhooks → l'adresse devient `…/functions/v1/stripe-webhook` ; remets le nouveau secret de signature.
- **Meta / WhatsApp Cloud** (si utilisé) : callback `…/functions/v1/whatsapp-webhook` + `WHATSAPP_VERIFY_TOKEN`.
- **Site harmonie-yacht.fr** : l'adresse du formulaire de réservation (`booking-form-webhook`), de `track-pageview` et de `lead-magnet-signup`, ainsi que la clé anon.
- **Qonto / SumUp** : les synchros horaires se remettent seules une fois les secrets posés (tâches planifiées déjà dans le SQL).
- **Domaine** : si une adresse perso pointait sur l'ancien projet, la repointer.

## 8. Vérifications finales

- [ ] Tableau de bord : leads, réservations, finances identiques aux chiffres d'avant (compare avec le rapport).
- [ ] `/health` du service WhatsApp : `connected: true`. Envoie un message test depuis un autre téléphone : Léa répond.
- [ ] Une réservation test depuis le site arrive dans le tableau.
- [ ] Paramètres → Banque Qonto : « Solde synchronisé » (au bout d'une heure).
- [ ] Une sauvegarde fraîche (`/sauvegarde`) : fais-la une fois que tout marche, puis régulièrement.

## Ce qui ne revient pas

- Les mots de passe de connexion (nouvelle saisie).
- Les secrets des fonctions et les clés d'API (à ressaisir depuis chaque service).
- Les anciens journaux d'exécution et l'historique de la base (le contenu des tables revient, pas son historique technique).
