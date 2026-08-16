-- Vue « dernier message » par lead.
--
-- Le signal le plus utile pour prioriser un prospect n'est pas son score, c'est
-- QUI a parlé en dernier. Si le client a écrit et que personne n'a répondu, on
-- est le point de blocage. S'il s'est tu après qu'on lui ait envoyé le site,
-- c'est une relance à faire. Ces deux cas demandent des actions opposées et
-- étaient jusqu'ici confondus dans un unique « sans interaction depuis 48h ».
--
-- security_invoker : la vue applique les politiques RLS de l'appelant plutôt
-- que celles de son propriétaire — sinon elle contournerait la sécurité des
-- tables sous-jacentes.

create or replace view lead_last_message
with (security_invoker = true) as
select distinct on (c.lead_id)
  c.lead_id,
  m.created_at                                        as last_message_at,
  m.from_me                                           as last_from_me,
  m.is_from_human                                     as last_is_from_human,
  (m.from_me and m.body ilike '%harmonie-yacht.fr%')  as site_link_sent
from wa_conversations c
join wa_messages m on m.conversation_id = c.id
where c.lead_id is not null
order by c.lead_id, m.created_at desc;
