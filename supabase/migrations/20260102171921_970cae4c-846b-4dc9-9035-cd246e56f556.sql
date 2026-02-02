-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member', 'viewer');

-- 1. Organizations (Tenants)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Organization Members
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- 3. Profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  full_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. WhatsApp Accounts (WABA)
CREATE TABLE public.whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  waba_id VARCHAR(100) NOT NULL,
  business_manager_id VARCHAR(100),
  access_token_encrypted TEXT,
  webhook_verify_token VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  meta_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Phone Numbers
CREATE TABLE public.phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  phone_number_id VARCHAR(100) NOT NULL,
  display_name VARCHAR(255),
  quality_rating VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Message Templates
CREATE TABLE public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE NOT NULL,
  template_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  language VARCHAR(10) NOT NULL,
  category VARCHAR(50),
  status VARCHAR(50),
  components JSONB NOT NULL,
  example_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- 7. Contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  conversation_state VARCHAR(100),
  last_interaction_at TIMESTAMPTZ,
  opted_in BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, phone_number)
);

-- 8. Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  phone_number_id UUID REFERENCES public.phone_numbers(id),
  status VARCHAR(50) DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id),
  window_expires_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  whatsapp_message_id VARCHAR(255),
  direction VARCHAR(10) NOT NULL,
  type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);

-- 10. Flows (Automation Flows)
CREATE TABLE public.flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Flow Nodes
CREATE TABLE public.flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES public.flows(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  config JSONB NOT NULL,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Flow Edges
CREATE TABLE public.flow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES public.flows(id) ON DELETE CASCADE NOT NULL,
  source_node_id UUID REFERENCES public.flow_nodes(id) ON DELETE CASCADE NOT NULL,
  target_node_id UUID REFERENCES public.flow_nodes(id) ON DELETE CASCADE NOT NULL,
  source_handle VARCHAR(50),
  label VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Flow Executions
CREATE TABLE public.flow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES public.flows(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id),
  status VARCHAR(50) DEFAULT 'running',
  trigger_data JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- 14. Flow Execution Logs
CREATE TABLE public.flow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES public.flow_executions(id) ON DELETE CASCADE NOT NULL,
  node_id UUID REFERENCES public.flow_nodes(id),
  status VARCHAR(50),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Campaigns
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES public.message_templates(id),
  phone_number_id UUID REFERENCES public.phone_numbers(id),
  status VARCHAR(50) DEFAULT 'draft',
  audience_filter JSONB,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  stats JSONB DEFAULT '{"total": 0, "sent": 0, "delivered": 0, "read": 0, "failed": 0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Webhook Logs
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  source VARCHAR(100),
  event_type VARCHAR(100),
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_received ON public.webhook_logs(received_at DESC);

-- 17. API Keys
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Security definer function to check organization membership
CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = _user_id
$$;

-- Security definer function to check admin role
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role = 'admin'
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Organizations policies
CREATE POLICY "Users can view their organizations" ON public.organizations
FOR SELECT USING (id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Users can create organizations" ON public.organizations
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update their organizations" ON public.organizations
FOR UPDATE USING (public.is_org_admin(auth.uid(), id));

-- Organization members policies
CREATE POLICY "Users can view members of their organizations" ON public.organization_members
FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Users can insert themselves as org members" ON public.organization_members
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update org members" ON public.organization_members
FOR UPDATE USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can delete org members" ON public.organization_members
FOR DELETE USING (public.is_org_admin(auth.uid(), organization_id));

-- WhatsApp accounts policies
CREATE POLICY "Users can view whatsapp accounts of their orgs" ON public.whatsapp_accounts
FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Admins can manage whatsapp accounts" ON public.whatsapp_accounts
FOR ALL USING (public.is_org_admin(auth.uid(), organization_id));

-- Phone numbers policies
CREATE POLICY "Users can view phone numbers" ON public.phone_numbers
FOR SELECT USING (
  whatsapp_account_id IN (
    SELECT id FROM whatsapp_accounts WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Admins can manage phone numbers" ON public.phone_numbers
FOR ALL USING (
  whatsapp_account_id IN (
    SELECT id FROM whatsapp_accounts WHERE public.is_org_admin(auth.uid(), organization_id)
  )
);

-- Message templates policies
CREATE POLICY "Users can view templates" ON public.message_templates
FOR SELECT USING (
  whatsapp_account_id IN (
    SELECT id FROM whatsapp_accounts WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Users can manage templates" ON public.message_templates
FOR ALL USING (
  whatsapp_account_id IN (
    SELECT id FROM whatsapp_accounts WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);

-- Contacts policies
CREATE POLICY "Users can view contacts" ON public.contacts
FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Users can create contacts" ON public.contacts
FOR INSERT WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Users can update contacts" ON public.contacts
FOR UPDATE USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Admins can delete contacts" ON public.contacts
FOR DELETE USING (public.is_org_admin(auth.uid(), organization_id));

-- Conversations policies
CREATE POLICY "Users can view conversations" ON public.conversations
FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Users can manage conversations" ON public.conversations
FOR ALL USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Messages policies
CREATE POLICY "Users can view messages" ON public.messages
FOR SELECT USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Users can create messages" ON public.messages
FOR INSERT WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);

-- Flows policies
CREATE POLICY "Users can view flows" ON public.flows
FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Users can manage flows" ON public.flows
FOR ALL USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Flow nodes policies
CREATE POLICY "Users can view flow nodes" ON public.flow_nodes
FOR SELECT USING (flow_id IN (SELECT id FROM flows WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));

CREATE POLICY "Users can manage flow nodes" ON public.flow_nodes
FOR ALL USING (flow_id IN (SELECT id FROM flows WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));

-- Flow edges policies
CREATE POLICY "Users can view flow edges" ON public.flow_edges
FOR SELECT USING (flow_id IN (SELECT id FROM flows WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));

CREATE POLICY "Users can manage flow edges" ON public.flow_edges
FOR ALL USING (flow_id IN (SELECT id FROM flows WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));

-- Flow executions policies
CREATE POLICY "Users can view flow executions" ON public.flow_executions
FOR SELECT USING (flow_id IN (SELECT id FROM flows WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));

CREATE POLICY "Users can manage flow executions" ON public.flow_executions
FOR ALL USING (flow_id IN (SELECT id FROM flows WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));

-- Flow execution logs policies
CREATE POLICY "Users can view execution logs" ON public.flow_execution_logs
FOR SELECT USING (
  execution_id IN (
    SELECT id FROM flow_executions WHERE flow_id IN (
      SELECT id FROM flows WHERE organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    )
  )
);

-- Campaigns policies
CREATE POLICY "Users can view campaigns" ON public.campaigns
FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Users can manage campaigns" ON public.campaigns
FOR ALL USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Webhook logs policies
CREATE POLICY "Users can view webhook logs" ON public.webhook_logs
FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- API keys policies
CREATE POLICY "Users can view api keys" ON public.api_keys
FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Admins can manage api keys" ON public.api_keys
FOR ALL USING (public.is_org_admin(auth.uid(), organization_id));

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_accounts_updated_at BEFORE UPDATE ON public.whatsapp_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON public.phone_numbers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON public.flows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON public.message_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;