-- =============================================
-- WARMING BUTTON ACTIONS
-- Adiciona suporte a fluxo de botoes no warming
-- =============================================

-- Adicionar coluna button_actions na tabela de mensagens
ALTER TABLE warming_member_messages
ADD COLUMN IF NOT EXISTS button_actions JSONB DEFAULT '{}';

COMMENT ON COLUMN warming_member_messages.button_actions IS
'Acoes a executar quando lead clica em cada botao do template. Formato: {"Confirmar": [{type, message, ...}], "Cancelar": [{...}]}';

-- =============================================
-- TABELA PARA RASTREAR MENSAGENS INTERATIVAS
-- Quando uma acao envia botoes, precisamos rastrear
-- para processar os sub-fluxos
-- =============================================

CREATE TABLE IF NOT EXISTS warming_interactive_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referencia a execucao original
  warming_message_execution_id UUID REFERENCES warming_message_executions(id) ON DELETE CASCADE,

  -- Contato que recebeu
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- WABA que enviou
  whatsapp_account_id UUID REFERENCES whatsapp_accounts(id) ON DELETE SET NULL,

  -- ID da mensagem no WhatsApp (para match no webhook)
  message_id VARCHAR(255) NOT NULL,

  -- Sub-fluxos configurados para cada botao
  button_flows JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  clicked_at TIMESTAMPTZ,
  button_clicked VARCHAR(255)
);

-- Indices para busca rapida
CREATE INDEX IF NOT EXISTS idx_warming_interactive_message_id
ON warming_interactive_messages(message_id);

CREATE INDEX IF NOT EXISTS idx_warming_interactive_contact
ON warming_interactive_messages(contact_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE warming_interactive_messages ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios podem ver mensagens interativas de seus pools
CREATE POLICY "Users can view warming interactive messages"
ON warming_interactive_messages FOR SELECT
USING (
  whatsapp_account_id IN (
    SELECT wa.id FROM whatsapp_accounts wa
    WHERE wa.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Policy: usuarios podem gerenciar mensagens interativas
CREATE POLICY "Users can manage warming interactive messages"
ON warming_interactive_messages FOR ALL
USING (
  whatsapp_account_id IN (
    SELECT wa.id FROM whatsapp_accounts wa
    WHERE wa.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- =============================================
-- TABELA DE EVENTOS DE FUNIL DO WARMING
-- Para analytics igual campanhas
-- =============================================

CREATE TABLE IF NOT EXISTS warming_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  warming_pool_id UUID NOT NULL REFERENCES warming_pools(id) ON DELETE CASCADE,
  warming_member_message_id UUID REFERENCES warming_member_messages(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Qual botao foi clicado
  button_text VARCHAR(255) NOT NULL,

  -- Qual etapa do fluxo (0 = clique no botao)
  step_index INTEGER DEFAULT 0,

  -- Tipo e label da acao
  action_type VARCHAR(50) NOT NULL,
  action_label VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'executed',

  -- Dados extras
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_warming_funnel_pool
ON warming_funnel_events(warming_pool_id);

CREATE INDEX IF NOT EXISTS idx_warming_funnel_message
ON warming_funnel_events(warming_member_message_id);

CREATE INDEX IF NOT EXISTS idx_warming_funnel_contact
ON warming_funnel_events(contact_id);

CREATE INDEX IF NOT EXISTS idx_warming_funnel_button
ON warming_funnel_events(button_text);

-- RLS
ALTER TABLE warming_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view warming funnel events"
ON warming_funnel_events FOR SELECT
USING (
  warming_pool_id IN (
    SELECT wp.id FROM warming_pools wp
    WHERE wp.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Users can manage warming funnel events"
ON warming_funnel_events FOR ALL
USING (
  warming_pool_id IN (
    SELECT wp.id FROM warming_pools wp
    WHERE wp.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);
