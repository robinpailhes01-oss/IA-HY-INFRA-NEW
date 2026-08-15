-- Canaux d'acquisition : ajout des IA génératives (ChatGPT, Perplexity...) pour
-- pouvoir mesurer ce que rapporte le travail GEO.
--
-- Au passage, la liste autorisée sur `leads` était plus courte que le menu
-- déroulant du dashboard : choisir "Google (recherche)" ou "Je ne sais pas" sur
-- une fiche prospect provoquait une erreur de contrainte. On aligne les deux, et
-- on ajoute 'direct' qui est déjà utilisé côté bookings.

alter table leads drop constraint if exists leads_source_channel_check;

alter table leads add constraint leads_source_channel_check
  check (source_channel = any (array[
    'instagram_organic', 'instagram_ads',
    'tiktok_organic', 'tiktok_ads',
    'meta_ads',
    'google_ads', 'google_organic',
    'chatgpt', 'perplexity', 'ai_other',
    'whatsapp', 'email', 'website', 'phone',
    'word_of_mouth', 'direct', 'other', 'unknown'
  ]::text[]));
