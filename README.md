# Harmonie Yacht — Dashboard

Dashboard de pilotage d'Harmonie Yacht (location de yacht, Port de Carnon) :
leads, réservations, finances, marketing, événements publics et l'agent IA « Léa ».

## Stack

- **Frontend** : Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend** : Supabase (Postgres + Auth + Storage + Edge Functions)
- **Workflows** : n8n Cloud
- **IA** : Claude API (Haiku 4.5 / Sonnet 4.6)
- **Intégrations** : WhatsApp Business API, ManyChat, Google Calendar, SumUp, Open-Meteo Marine
- **Hébergement** : Vercel

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs
npm run dev
```

L'app tourne sur http://localhost:3000.

## Structure

```
app/            Routes (App Router)
components/ui/  Composants shadcn/ui
lib/supabase/   Clients Supabase (client / server / middleware)
types/          Types TypeScript (database.ts généré depuis Supabase)
```

## Variables d'environnement

Voir `.env.example`. Le projet Supabase est `harmonie-yacht` (région `eu-west-3`).
La clé `SUPABASE_SERVICE_ROLE_KEY` est secrète : à récupérer dans
Supabase → Project Settings → API.

## Roadmap

Voir `ROADMAP.md` (sprints 0 → 11) et `SPECS.md` (référence technique).
