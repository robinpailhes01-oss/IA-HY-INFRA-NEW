# Reconstruction de la base Harmonie Yacht

Le projet Supabase d'origine n'est plus accessible. Ce dossier contient de quoi
recréer la base **à l'identique** dans un nouveau projet, puis y remettre les
données d'une sauvegarde (page **Outils → Sauvegarde** du tableau de bord).

| Fichier | Rôle |
|---|---|
| `01_base_schema.sql` | Les 32 tables « de base » (leads, réservations, clients, WhatsApp…), **reconstituées** depuis les types générés. Généré par `scripts/rebuild/gen_base_schema.py`. |
| `02_post_base.sql` | Fonction `get_booked_slots`, profil créé à chaque nouveau compte, accès (RLS). |
| `../migrations/0001…0035` | Les ajouts faits ensuite (déjà dans le dépôt). |
| `03_after_migrations.sql` | La vue `site_daily_snapshots`, droits sur les vues. |
| `schema-complete.template.sql` | Tout ça assemblé, prêt à coller dans **SQL Editor**. Remplacer `aaaaaaaaaaaaaaaaaaaa` par l'identifiant du nouveau projet (20 caractères, dans son adresse `https://<identifiant>.supabase.co`). |

Régénérer : `python3 scripts/rebuild/build_schema.py --url https://<identifiant>.supabase.co > schema-complete.sql`.

## Ce qui est reconstitué, et ce qui est deviné

Sûr : les colonnes, leur nullabilité, les clés étrangères, tout ce que les
migrations définissent (tables, déclencheurs, vues, tâches planifiées).

Deviné : les **types SQL** des tables de base (déduits des noms de colonnes) et
les contraintes CHECK (volontairement absentes : on accepte toute donnée
historique). Test : le schéma s'applique sur PostgreSQL 16 sans erreur, les
migrations passent, et le jeu de démonstration (`supabase/seed.sql`) s'y charge.
La sauvegarde contient le **schéma réel** (`schema/openapi.json`) : on le compare
au schéma reconstruit pour corriger tout écart.

Le déclencheur `bookings_to_revenues` recrée des lignes de `revenues` à chaque
réservation insérée : la page de restauration vide `revenues` (et
`accounting_entries`, `accounting_rules`) juste avant d'importer les originaux.

## Tests

```
# base de test locale avec émulation de Supabase
psql -d t1 -f scripts/rebuild/test/supabase_stubs.sql
python3 scripts/rebuild/build_schema.py --url https://aaaaaaaaaaaaaaaaaaaa.supabase.co --strip-extensions | psql -d t1
# logique de restauration (lots, colonnes inconnues, ligne fautive)
node --experimental-strip-types scripts/rebuild/test/restore.test.mjs
```
