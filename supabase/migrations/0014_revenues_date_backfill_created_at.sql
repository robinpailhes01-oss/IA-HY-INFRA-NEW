-- Correction du correctif précédent (0013) : updated_at avait déjà été
-- pollué par la migration 0011 (qui touchait toutes les réservations d'un
-- coup), donc son utilisation comme proxy de date de backfill donnait un
-- historique artificiellement compressé sur 1-2 jours. created_at n'a
-- jamais été touché par ces migrations et reflète un vrai étalement
-- historique (juin-juillet) — bien plus fidèle pour les lignes déjà
-- existantes. N'affecte pas le trigger lui-même (déjà correct depuis 0013,
-- utilise current_date pour toute nouvelle ligne).

begin;

update public.revenues r
set date = b.created_at::date
from public.bookings b
where r.booking_id = b.id;

commit;
