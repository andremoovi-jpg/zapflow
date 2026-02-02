-- Add unique constraint for upsert on message_templates
-- This allows syncing templates without duplicates
ALTER TABLE public.message_templates 
ADD CONSTRAINT message_templates_account_template_unique 
UNIQUE (whatsapp_account_id, template_id);