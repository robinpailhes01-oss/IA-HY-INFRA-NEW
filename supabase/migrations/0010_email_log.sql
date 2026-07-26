-- Journal des emails envoyés (confirmations, relances, réponses, envois manuels).
-- Sert à compter le total d'emails envoyés pour la page Résultats.

CREATE TABLE IF NOT EXISTS public.email_log (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id    uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  to_email   text NOT NULL,
  subject    text,
  -- 'booking_confirmation' | 'inbound_reply' | 'followup' | 'manual_dashboard'
  source     text NOT NULL,
  sent_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON public.email_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_log_lead_id ON public.email_log(lead_id);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
  ON public.email_log FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
