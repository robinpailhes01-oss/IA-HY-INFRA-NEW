# Point de reprise — reconnexion au nouveau Supabase

État au 19 nov. 2026. Aucun secret dans ce fichier.

## Où on en est

- Nouveau projet Supabase : `fscrhzxpmxvejrhppftc` (ancien : `szdfpjyytwedhochvzfd`, inaccessible).
- Schéma appliqué (migrations 0001→0037), 21 fonctions déployées, Vercel (`ia-hy-infra-new`) pointe sur le nouveau projet, inscriptions désactivées.
- Restauration de la sauvegarde lancée une fois : 4 820 lignes sur 4 880. À relancer avec le même ZIP (page `/restauration`, variable Vercel `HY_ENABLE_RESTORE=1`), puis : remettre les 15 règles comptables par défaut (insert de la migration 0035), vérifier `bookings.payment_ref`, retirer `HY_ENABLE_RESTORE`.
- Météo marine + récap quotidien : en place (`weather-sync`, `daily-recap`, carte sur la vue d'ensemble).
- Boîte mail (migration 0037, fonctions `mail-oauth`, `mail-sync`, `mail-act`, page `/mails`) : prête, **pas encore connectée**. Il manque côté Supabase (Edge Functions → Secrets) : `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `DASHBOARD_URL`, `DASHBOARD_AGENT_SECRET`. URI de redirection Google : `https://fscrhzxpmxvejrhppftc.supabase.co/functions/v1/mail-oauth`, scope `gmail.modify`, application « En production ».

## À faire ensuite

1. **Site public** (dépôt `robinpailhes01-oss/TESTE-HYSITE`, projet Vercel `teste-hysite`, domaine harmonie-yacht.fr, branche par défaut `claude/harmonie-yacht-website-dcwk52`) :
   - l'ancienne adresse Supabase est écrite en dur dans `src/availability.ts`, `src/components/LeadMagnet.tsx`, `api/create-checkout.ts`, `api/verify-checkout.ts` (+ clé anon) ;
   - le paiement passe par SumUp : il faut recréer la table `pending_checkouts` (à déduire du code de `api/create-checkout.ts`), déployer `supabase-functions/sumup-webhook`, remettre `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `SUPABASE_SERVICE_ROLE_KEY` dans Vercel et dans les secrets Supabase ;
   - la branche `tarifs-nuit-seule-200` (nuit seule 200 €, petit-déjeuner à bord pendant la fermeture de l'Hôtel Neptune, à rétablir à la mi-mars) est poussée, non fusionnée ;
   - faire un paiement test avant de fusionner.
2. **Agent WhatsApp** : variables Railway du service Baileys (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LEA_SHARED_SECRET`), `/health`, scan du QR, `BAILEYS_SERVICE_URL` dans Vercel et les secrets.
3. **Webhooks à repointer** : Telegram, Stripe (`…/functions/v1/stripe-webhook`), Meta si utilisé, formulaires du site (`booking-form-webhook`, `track-pageview`, `lead-magnet-signup`).
4. **Secrets des fonctions** : voir `docs/supabase-secrets.env.template` et `docs/reconstruction.md`.
5. En fin de parcours : passer Supabase en Pro, révoquer le jeton d'accès personnel (PAT) utilisé pour la reconstruction, créer les autres comptes du personnel.

## Dépôts

- Tableau de bord : `robinpailhes01-oss/IA-HY-INFRA-NEW`, branche `claude/keen-cray-IEgV8` (déployée en production : ne pousser que du code vérifié).
- Site : `robinpailhes01-oss/TESTE-HYSITE`.
- `robinpailhes01-oss/HY-SITE-` n'est PAS le site en ligne.
