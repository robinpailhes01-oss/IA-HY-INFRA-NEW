-- Suivi des threads email : lie les Message-ID/In-Reply-To aux conversations CRM.
-- Permet à l'agent email de retrouver le fil de discussion quand un client répond.

CREATE TABLE IF NOT EXISTS public.email_threads (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id   uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  lead_id           uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  from_email        text NOT NULL,
  subject           text,
  -- Message-ID du dernier email envoyé (pour le header In-Reply-To de la prochaine réponse).
  last_outbound_message_id text,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_threads_conversation_id
  ON public.email_threads(conversation_id);

CREATE INDEX IF NOT EXISTS idx_email_threads_lead_id
  ON public.email_threads(lead_id);

-- Recherche rapide par adresse email expéditeur (= identification du lead).
CREATE INDEX IF NOT EXISTS idx_email_threads_from_email
  ON public.email_threads(from_email);

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
  ON public.email_threads FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
