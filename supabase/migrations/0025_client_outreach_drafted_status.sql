-- Ajoute le statut "drafted" : un brouillon Gmail a été créé pour ce client,
-- mais rien n'est parti — Robin doit encore l'ouvrir et cliquer "Envoyer"
-- lui-même dans Gmail. Distinct de "sending"/"sent" qui décrivent un envoi
-- automatique via Resend.
alter table client_outreach drop constraint client_outreach_status_check;
alter table client_outreach add constraint client_outreach_status_check
  check (status in ('pending', 'drafted', 'sending', 'sent', 'failed', 'skipped'));
