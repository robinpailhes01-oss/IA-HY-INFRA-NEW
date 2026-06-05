-- Link WhatsApp conversations to leads so the dashboard can show the WhatsApp
-- thread on the lead detail page, and so the agent can find existing leads by
-- conversation rather than only by phone string-matching.
alter table public.wa_conversations
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists idx_wa_conversations_lead_id on public.wa_conversations(lead_id);
create index if not exists idx_wa_conversations_customer_phone on public.wa_conversations(customer_phone);
create index if not exists idx_leads_phone on public.leads(phone);
