-- Create campaign_messages table
CREATE TABLE public.campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_campaign_messages_campaign ON public.campaign_messages(campaign_id);
CREATE INDEX idx_campaign_messages_status ON public.campaign_messages(status);
CREATE INDEX idx_campaign_messages_contact ON public.campaign_messages(contact_id);

-- Enable RLS
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaign_messages
CREATE POLICY "Users can view campaign messages"
ON public.campaign_messages
FOR SELECT
USING (
  campaign_id IN (
    SELECT id FROM campaigns 
    WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Users can create campaign messages"
ON public.campaign_messages
FOR INSERT
WITH CHECK (
  campaign_id IN (
    SELECT id FROM campaigns 
    WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Users can update campaign messages"
ON public.campaign_messages
FOR UPDATE
USING (
  campaign_id IN (
    SELECT id FROM campaigns 
    WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Enable realtime for campaigns table
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_messages;