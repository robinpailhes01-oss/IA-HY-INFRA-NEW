-- Liste globale de désabonnement — vérifiée par TOUTE campagne de relance,
-- pas seulement celle qui a déclenché le clic. Une personne qui se désabonne
-- ne doit plus jamais recevoir d'email marketing, quelle que soit la
-- campagne future.

create table if not exists email_unsubscribes (
  email text primary key,
  unsubscribed_at timestamptz not null default now(),
  -- Campagne à l'origine du désabonnement, pour comprendre d'où ça vient.
  source_campaign text
);

alter table email_unsubscribes enable row level security;

-- Lecture/écriture normale depuis le dashboard (vérifier qui s'est désabonné).
drop policy if exists "Authenticated users full access" on email_unsubscribes;
create policy "Authenticated users full access"
  on email_unsubscribes for all
  to authenticated
  using (true)
  with check (true);

-- Le lien de désabonnement dans l'email est cliqué par quelqu'un qui n'est
-- JAMAIS connecté au dashboard. La route /api/unsubscribe utilise donc la clé
-- de service (contourne RLS) plutôt qu'une policy anonyme ici — écrire une
-- policy "anon" reviendrait à autoriser n'importe qui sur internet à insérer
-- des lignes arbitraires dans cette table sans passer par notre validation
-- du jeton.
