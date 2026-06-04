# Léa sur WhatsApp — mise en route

Léa est l'assistante conversationnelle de Harmonie Yacht. Elle **informe, qualifie,
communique les disponibilités et relance** — elle ne prend **pas** les réservations
(celles-ci se font sur le site). Ce document décrit comment brancher le canal WhatsApp
(Meta Cloud API, en direct, sans intermédiaire type Manychat).

## Architecture

```
Client WhatsApp
      │  (message)
      ▼
Meta Cloud API ──webhook──▶ supabase/functions/whatsapp-webhook
                                   │  POST {message, phone}
                                   ▼
                            supabase/functions/agent-lea  ◀── le cerveau (Claude + tools)
                                   │  {reply}
                                   ▼
                            Graph API WhatsApp ──▶ Client WhatsApp

Cron horaire ──▶ supabase/functions/lea-followups ──▶ relances WhatsApp
```

- **`whatsapp-webhook`** : fonction fine, aucun métier. Vérifie le webhook (GET) et
  transmet chaque message texte à `agent-lea`, puis renvoie la réponse au client.
- **`agent-lea`** : toute l'intelligence. Outils : `create_lead`, `qualify_lead`,
  `update_lead_status`, `escalate_to_human`, `get_active_events`, **`check_availability`**
  (nouveau), **`send_booking_link`** (nouveau).
- **`lea-followups`** : cron de relances (1 à 3 selon `agent_config`).
- Les conversations sont stockées dans la table **`conversations`** existante (par `lead_id`).

## Secrets à définir (Supabase → Project Settings → Edge Functions → Secrets)

| Secret | Fonction | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | agent-lea, lea-followups | clé API Anthropic |
| `WHATSAPP_VERIFY_TOKEN` | whatsapp-webhook | chaîne secrète **que tu choisis** (à recopier dans la config webhook Meta) |
| `WHATSAPP_TOKEN` | whatsapp-webhook, lea-followups | access token **permanent** Meta (System User) |
| `WHATSAPP_PHONE_NUMBER_ID` | whatsapp-webhook, lea-followups | ID du numéro WhatsApp (console Meta) |
| `SITE_BOOKING_URL` | agent-lea | URL de réservation du site (ex. `https://harmonie-yacht.fr/reserver`) |
| `LEA_SHARED_SECRET` | agent-lea (+ webhook) | optionnel : protège agent-lea ; si défini, le webhook l'envoie |
| `CRON_SECRET` | lea-followups | optionnel : protège l'endpoint de relance |
| `GRAPH_API_VERSION` | webhook, followups | optionnel, défaut `v21.0` |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement.

## Côté Meta (à récupérer)

1. App Meta for Developers (type *Entreprise*) + produit **WhatsApp** ajouté.
2. Dans **WhatsApp → Configuration de l'API** : note le `Phone number ID` et le
   `WhatsApp Business Account ID`.
3. Crée un **System User** (Business Settings) avec un **token permanent** ayant les
   permissions `whatsapp_business_messaging` + `whatsapp_business_management`.
4. **Webhook** : URL = `https://<PROJECT>.supabase.co/functions/v1/whatsapp-webhook`,
   *Verify token* = la valeur de `WHATSAPP_VERIFY_TOKEN`. Abonne le champ **`messages`**.

> Tant que l'entreprise n'est pas vérifiée par Meta, utilise le **numéro de test**
> fourni gratuitement pour développer/tester. La vérification (K-bis) se fait en parallèle.

## Déploiement

```bash
# Schéma (colonnes de relance)
supabase db push          # applique supabase/migrations/0001_lea_followups.sql

# Fonctions
supabase functions deploy agent-lea
supabase functions deploy whatsapp-webhook   # verify_jwt désactivé (Meta appelle sans JWT)
supabase functions deploy lea-followups
```

⚠️ `whatsapp-webhook` doit être déployée **sans vérification JWT** (Meta n'envoie pas de
JWT). Désactive-le dans le dashboard (Edge Functions → whatsapp-webhook → *Verify JWT* off)
ou via `config.toml`.

## Cron des relances

Planifie un appel horaire à `lea-followups` (pg_cron + `pg_net`, ou un scheduler externe) :

```sql
select cron.schedule(
  'lea-followups-hourly',
  '0 * * * *',
  $$ select net.http_post(
       url    := 'https://<PROJECT>.supabase.co/functions/v1/lea-followups',
       headers:= '{"content-type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
       body   := '{}'::jsonb
     ); $$
);
```

Les délais (24h / 72h / 168h) et le nombre max de relances viennent de `agent_config`
(`faq.agent_settings.followup_intervals_hours`, `max_followups`, `auto_followup_enabled`).

## Test bout en bout

1. Depuis le **numéro de test** Meta, envoie un message au numéro WhatsApp Business.
2. Vérifie qu'une fiche **lead** apparaît dans le Kanban (canal *WhatsApp*) et que Léa répond.
3. Demande une dispo (« Vous avez de la place le 14 juin ? ») → Léa appelle
   `check_availability`.
4. Dis « je veux réserver » → Léa renvoie le lien `SITE_BOOKING_URL`.
5. Déclenche manuellement `lea-followups` (POST) pour valider une relance.

## Valeurs encore `TO_BE_PROVIDED` (dans `agent_config`)

À renseigner via le dashboard Paramètres pour que Léa soit pleinement opérationnelle :
`booking_process.deposit_link` (sinon `SITE_BOOKING_URL`), les contacts partenaires
(Una Mas, Maison Perla), et `whatsapp_public_group_link`.
