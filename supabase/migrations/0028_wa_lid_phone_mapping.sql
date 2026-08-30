-- Résolution LID → numéro réel. WhatsApp masque certains contacts derrière un
-- identifiant interne (LID, ex. "86630044070080@lid") au lieu de leur vrai
-- numéro — c'est ce qui rend "impossible" la relance directe par le Manager.
-- Baileys reçoit pourtant cette correspondance via plusieurs événements
-- (partage explicite du numéro, synchronisation des contacts/historique) —
-- on ne les écoutait simplement pas. Cette table les capture au fil de l'eau.
create table wa_lid_map (
  lid text primary key,
  phone text not null,
  source text not null default 'baileys',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wa_lid_map_phone_idx on wa_lid_map (phone);

-- Numéro réel résolu pour un lead dont le numéro stocké est un LID masqué.
-- On NE remplace PAS leads.phone (qui reste le LID, seul identifiant fiable
-- pour router les messages WhatsApp entrants/sortants) — real_phone est un
-- champ d'affichage/relance en plus, jamais l'identité de la conversation.
alter table leads add column real_phone text;
