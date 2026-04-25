-- Ticket status & sender enums
CREATE TYPE public.ticket_status AS ENUM ('open','escalated','resolved');
CREATE TYPE public.ticket_classification AS ENUM ('unclassified','account','payments','cards','loans','fd','autopay','other');
CREATE TYPE public.message_sender AS ENUM ('user','ai','staff');

-- Tickets
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  classification public.ticket_classification NOT NULL DEFAULT 'unclassified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);

-- Messages
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender public.message_sender NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_messages_ticket ON public.ticket_messages(ticket_id, created_at);

-- updated_at trigger
CREATE TRIGGER tg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- User policies: own tickets only
CREATE POLICY "own tickets read" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tickets insert" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tickets update" ON public.support_tickets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "own ticket messages read" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "own ticket messages insert" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid())
    AND sender = 'user'
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;