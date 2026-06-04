# Synchronisation Google Calendar

Chaque booking confirmé/modifié/annulé est automatiquement reflété dans ton
calendrier Google. Léa lit aussi ce calendrier pour répondre aux questions de
disponibilité (en plus de la table `bookings`).

## Architecture

```
Site Next.js (Server Action updateBooking)
      │  syncGCal("upsert" | "delete", "booking", id)
      ▼
supabase/functions/sync-gcal   ← Edge Function
      │  Google Calendar API (Service Account)
      ▼
Ton calendrier Google

agent-lea (check_availability)
      ├── lit table bookings    (source principale)
      ├── lit table events_public
      └── lit Google Calendar  (blocages manuels, maintenance…)
```

## Secrets à définir

Dans Supabase → Project Settings → Edge Functions → Secrets **ET** dans les
variables d'environnement Vercel (pour le helper `lib/sync-gcal.ts`) :

| Secret | Description |
|---|---|
| `GOOGLE_CALENDAR_ID` | ID du calendrier (ex: `harmonieyacht@gmail.com` pour le principal, ou `xxx@group.calendar.google.com` pour un secondaire) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Valeur de `client_email` dans le JSON téléchargé |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Valeur de `private_key` dans le JSON (avec les `\n`) |
| `SYNC_GCAL_SECRET` | Chaîne secrète de ton choix (protège l'endpoint sync-gcal) |

`SUPABASE_SERVICE_ROLE_KEY` est déjà injecté côté Edge Functions, et doit être
ajouté dans Vercel pour que `lib/sync-gcal.ts` puisse appeler l'Edge Function.

## Étapes côté Google (à faire sur ordi — ~10 min)

### 1. Activer l'API Google Calendar
→ console.cloud.google.com/apis/library/calendar-json.googleapis.com
→ Sélectionner ton projet → **Activer**

### 2. Créer le Service Account
→ console.cloud.google.com/iam-admin/serviceaccounts
→ **+ Créer un compte de service**
- Nom : `harmonie-yacht-calendar-sync`
- Pas de rôle IAM nécessaire → **OK**

### 3. Télécharger la clé JSON
→ Clique sur le Service Account créé → onglet **Clés**
→ **Ajouter une clé → Créer une clé → JSON → Créer**
→ Récupère `client_email` et `private_key` dans ce fichier

### 4. Partager le calendrier avec le Service Account
→ calendar.google.com → calendrier cible → **Paramètres et partage**
→ "Partager avec des personnes" → ajouter l'email du Service Account
→ Permission : **"Apporter des modifications aux événements"**

### 5. Récupérer l'ID du calendrier
→ Même page → section **"Intégrer le calendrier"**
→ Copier **"ID du calendrier"**

## Déploiement

```bash
# Migration (colonne google_calendar_event_id)
supabase db push   # applique migrations/0002_google_calendar_event_id.sql

# Edge Function
supabase functions deploy sync-gcal
```

## Sync initiale (bookings existants)

Pour remplir GCal avec les réservations déjà en base, exécute ce script SQL
dans l'éditeur Supabase (une seule fois) :

```sql
-- Déclenche une sync pour chaque booking actif sans event GCal
-- (à lancer manuellement une fois les secrets en place)
select net.http_post(
  url    := '<SUPABASE_URL>/functions/v1/sync-gcal',
  headers:= json_build_object(
    'content-type', 'application/json',
    'authorization', 'Bearer <SERVICE_ROLE_KEY>',
    'x-sync-secret', '<SYNC_GCAL_SECRET>'
  )::jsonb,
  body   := json_build_object('action', 'upsert', 'type', 'booking', 'id', id)::jsonb
)
from bookings
where status in ('confirmed', 'pending')
  and google_calendar_event_id is null;
```

## Couleurs dans GCal

| Couleur | Signification |
|---|---|
| 🟢 Sauge | Sortie confirmée |
| 🟡 Banane | En attente d'acompte |
| ❌ Flamant | Annulé (supprimé de GCal) |
| 🟣 Raisin | Événement public |
