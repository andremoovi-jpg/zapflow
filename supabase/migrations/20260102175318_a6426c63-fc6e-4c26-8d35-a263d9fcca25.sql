
-- Add new columns to whatsapp_accounts for proxy and rate limiting
ALTER TABLE whatsapp_accounts 
ADD COLUMN IF NOT EXISTS app_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS app_secret_encrypted TEXT,
ADD COLUMN IF NOT EXISTS proxy_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS proxy_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS proxy_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS proxy_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS proxy_type VARCHAR(20) DEFAULT 'http',
ADD COLUMN IF NOT EXISTS webhook_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS rate_limit_per_second INTEGER DEFAULT 80,
ADD COLUMN IF NOT EXISTS rate_limit_per_day INTEGER DEFAULT 100000,
ADD COLUMN IF NOT EXISTS messages_sent_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rate_limit_reset_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS health_status VARCHAR(50) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_error_message TEXT,
ADD COLUMN IF NOT EXISTS business_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS business_vertical VARCHAR(100);

-- Add unique constraint for org + waba_id
ALTER TABLE whatsapp_accounts DROP CONSTRAINT IF EXISTS whatsapp_accounts_organization_id_waba_id_key;
ALTER TABLE whatsapp_accounts ADD CONSTRAINT whatsapp_accounts_organization_id_waba_id_key UNIQUE(organization_id, waba_id);

-- Create indexes for whatsapp_accounts
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_webhook ON whatsapp_accounts(webhook_url);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_org ON whatsapp_accounts(organization_id);

-- Add whatsapp_account_id to contacts for WABA isolation
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS whatsapp_account_id UUID REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS wa_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS current_flow_id UUID,
ADD COLUMN IF NOT EXISTS current_node_id UUID,
ADD COLUMN IF NOT EXISTS flow_context JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS first_interaction_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_messages_received INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_messages_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS opted_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;

-- Update contacts unique constraint to be per WABA
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_organization_id_phone_number_key;
ALTER TABLE contacts ADD CONSTRAINT contacts_waba_phone_key UNIQUE(whatsapp_account_id, phone_number);

-- Create indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_waba ON contacts(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);

-- Add whatsapp_account_id to conversations
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS whatsapp_account_id UUID REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS window_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_message_direction VARCHAR(10),
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_flow_id UUID,
ADD COLUMN IF NOT EXISTS flow_paused BOOLEAN DEFAULT FALSE;

-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_org ON conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_waba ON conversations(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(unread_count) WHERE unread_count > 0;

-- Add whatsapp_account_id to flows
ALTER TABLE flows 
ADD COLUMN IF NOT EXISTS whatsapp_account_id UUID REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS folder VARCHAR(100),
ADD COLUMN IF NOT EXISTS total_executions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS successful_executions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_executions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_execution_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS published_by UUID,
ADD COLUMN IF NOT EXISTS n8n_workflow_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Create indexes for flows
CREATE INDEX IF NOT EXISTS idx_flows_org ON flows(organization_id);
CREATE INDEX IF NOT EXISTS idx_flows_waba ON flows(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_flows_trigger ON flows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_flows_active ON flows(is_active) WHERE is_active = TRUE;

-- Add whatsapp_account_id to campaigns
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS whatsapp_account_id UUID REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS template_variables JSONB,
ADD COLUMN IF NOT EXISTS audience_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS audience_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS send_rate INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Create indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_waba ON campaigns(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE status = 'scheduled';

-- Add whatsapp_account_id to webhook_logs
ALTER TABLE webhook_logs 
ADD COLUMN IF NOT EXISTS whatsapp_account_id UUID REFERENCES whatsapp_accounts(id);

-- Create index for webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_waba ON webhook_logs(whatsapp_account_id);
