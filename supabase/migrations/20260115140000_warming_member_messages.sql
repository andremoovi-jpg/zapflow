-- =============================================
-- WARMING MEMBER MESSAGES
-- Fluxo de mensagens por WABA no pool
-- =============================================

-- Mensagens configuradas para cada WABA no pool
CREATE TABLE warming_member_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warming_pool_member_id UUID NOT NULL REFERENCES warming_pool_members(id) ON DELETE CASCADE,

  -- Ordem na sequencia
  sequence_order INTEGER DEFAULT 1,

  -- Template da WABA especifica
  template_id UUID,
  template_name VARCHAR(255) NOT NULL,
  template_language VARCHAR(10) DEFAULT 'pt_BR',

  -- Variaveis do template (header, body, buttons)
  template_variables JSONB DEFAULT '{}',
  -- Exemplo: {"header": {"type": "image", "url": "..."}, "body": ["var1", "var2"], "buttons": [{"type": "url", "url": "..."}]}

  -- Timing - quando enviar apos entrada no pool
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  delay_minutes INTEGER DEFAULT 0,

  -- Condicoes de envio
  only_if_no_reply BOOLEAN DEFAULT true,  -- So envia se contato nao respondeu
  skip_if_clicked BOOLEAN DEFAULT false,   -- Pula se ja clicou em link
  require_previous_delivered BOOLEAN DEFAULT true, -- So envia se anterior foi entregue

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metricas
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_warming_messages_member ON warming_member_messages(warming_pool_member_id);
CREATE INDEX idx_warming_messages_sequence ON warming_member_messages(warming_pool_member_id, sequence_order);
CREATE INDEX idx_warming_messages_active ON warming_member_messages(is_active);

-- Trigger para updated_at
CREATE TRIGGER trigger_warming_messages_updated_at
  BEFORE UPDATE ON warming_member_messages
  FOR EACH ROW EXECUTE FUNCTION update_warming_updated_at();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE warming_member_messages ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios podem ver mensagens de seus pools
CREATE POLICY "Users can view warming member messages"
ON warming_member_messages FOR SELECT
USING (
  warming_pool_member_id IN (
    SELECT wpm.id FROM warming_pool_members wpm
    JOIN warming_pools wp ON wp.id = wpm.warming_pool_id
    WHERE wp.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Policy: usuarios podem gerenciar mensagens de seus pools
CREATE POLICY "Users can manage warming member messages"
ON warming_member_messages FOR ALL
USING (
  warming_pool_member_id IN (
    SELECT wpm.id FROM warming_pool_members wpm
    JOIN warming_pools wp ON wp.id = wpm.warming_pool_id
    WHERE wp.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- =============================================
-- TABELA DE EXECUCAO DE MENSAGENS
-- Controla quais mensagens foram enviadas para cada contato
-- =============================================

CREATE TABLE warming_message_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warming_contact_history_id UUID NOT NULL REFERENCES warming_contact_history(id) ON DELETE CASCADE,
  warming_member_message_id UUID NOT NULL REFERENCES warming_member_messages(id) ON DELETE CASCADE,

  -- Status da execucao
  status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, sent, delivered, read, failed, skipped

  -- Agendamento
  scheduled_for TIMESTAMPTZ,

  -- Resultado
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Detalhes do envio
  whatsapp_message_id VARCHAR(255),
  error_message TEXT,

  -- Motivo se pulou
  skip_reason VARCHAR(100), -- replied, clicked, previous_failed, manual

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(warming_contact_history_id, warming_member_message_id)
);

-- Indices
CREATE INDEX idx_warming_executions_contact ON warming_message_executions(warming_contact_history_id);
CREATE INDEX idx_warming_executions_message ON warming_message_executions(warming_member_message_id);
CREATE INDEX idx_warming_executions_status ON warming_message_executions(status);
CREATE INDEX idx_warming_executions_scheduled ON warming_message_executions(scheduled_for) WHERE status = 'scheduled';

-- Trigger para updated_at
CREATE TRIGGER trigger_warming_executions_updated_at
  BEFORE UPDATE ON warming_message_executions
  FOR EACH ROW EXECUTE FUNCTION update_warming_updated_at();

-- RLS
ALTER TABLE warming_message_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view warming message executions"
ON warming_message_executions FOR SELECT
USING (
  warming_contact_history_id IN (
    SELECT wch.id FROM warming_contact_history wch
    JOIN warming_pools wp ON wp.id = wch.warming_pool_id
    WHERE wp.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Users can manage warming message executions"
ON warming_message_executions FOR ALL
USING (
  warming_contact_history_id IN (
    SELECT wch.id FROM warming_contact_history wch
    JOIN warming_pools wp ON wp.id = wch.warming_pool_id
    WHERE wp.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- =============================================
-- FUNCAO PARA AGENDAR MENSAGENS DO WARMING
-- =============================================

CREATE OR REPLACE FUNCTION schedule_warming_messages(
  p_contact_history_id UUID,
  p_pool_member_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg RECORD;
  entry_time TIMESTAMPTZ;
  scheduled_time TIMESTAMPTZ;
BEGIN
  -- Buscar hora de entrada do contato
  SELECT entered_at INTO entry_time
  FROM warming_contact_history
  WHERE id = p_contact_history_id;

  -- Iterar sobre mensagens ativas do membro
  FOR msg IN
    SELECT * FROM warming_member_messages
    WHERE warming_pool_member_id = p_pool_member_id
      AND is_active = true
    ORDER BY sequence_order
  LOOP
    -- Calcular horario agendado
    scheduled_time := entry_time
      + (msg.delay_days || ' days')::INTERVAL
      + (msg.delay_hours || ' hours')::INTERVAL
      + (msg.delay_minutes || ' minutes')::INTERVAL;

    -- Criar execucao agendada
    INSERT INTO warming_message_executions (
      warming_contact_history_id,
      warming_member_message_id,
      status,
      scheduled_for
    ) VALUES (
      p_contact_history_id,
      msg.id,
      CASE WHEN msg.sequence_order = 1 AND msg.delay_days = 0 AND msg.delay_hours = 0 AND msg.delay_minutes = 0
        THEN 'pending'
        ELSE 'scheduled'
      END,
      scheduled_time
    )
    ON CONFLICT (warming_contact_history_id, warming_member_message_id) DO NOTHING;
  END LOOP;
END;
$$;

-- =============================================
-- FUNCAO PARA BUSCAR PROXIMA MENSAGEM A ENVIAR
-- =============================================

CREATE OR REPLACE FUNCTION get_pending_warming_messages(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  execution_id UUID,
  contact_history_id UUID,
  contact_id UUID,
  contact_phone VARCHAR,
  contact_name VARCHAR,
  waba_id UUID,
  waba_phone_id VARCHAR,
  waba_token TEXT,
  template_name VARCHAR,
  template_language VARCHAR,
  template_variables JSONB,
  only_if_no_reply BOOLEAN,
  pool_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wme.id as execution_id,
    wch.id as contact_history_id,
    wch.contact_id,
    c.phone as contact_phone,
    c.name as contact_name,
    wpm.whatsapp_account_id as waba_id,
    wa.phone_number_id as waba_phone_id,
    wa.access_token as waba_token,
    wmm.template_name,
    wmm.template_language,
    wmm.template_variables,
    wmm.only_if_no_reply,
    wp.id as pool_id
  FROM warming_message_executions wme
  JOIN warming_contact_history wch ON wch.id = wme.warming_contact_history_id
  JOIN warming_member_messages wmm ON wmm.id = wme.warming_member_message_id
  JOIN warming_pool_members wpm ON wpm.id = wmm.warming_pool_member_id
  JOIN warming_pools wp ON wp.id = wpm.warming_pool_id
  JOIN whatsapp_accounts wa ON wa.id = wpm.whatsapp_account_id
  JOIN contacts c ON c.id = wch.contact_id
  WHERE wme.status IN ('pending', 'scheduled')
    AND wme.scheduled_for <= NOW()
    AND wp.status = 'active'
    AND wpm.status = 'active'
    AND wmm.is_active = true
    -- Verificar janela de tempo
    AND (
      NOT wp.time_window_enabled
      OR (
        EXTRACT(HOUR FROM NOW() AT TIME ZONE wp.timezone) >= EXTRACT(HOUR FROM wp.time_window_start)
        AND EXTRACT(HOUR FROM NOW() AT TIME ZONE wp.timezone) < EXTRACT(HOUR FROM wp.time_window_end)
        AND EXTRACT(DOW FROM NOW() AT TIME ZONE wp.timezone) = ANY(wp.allowed_days)
      )
    )
  ORDER BY wme.scheduled_for ASC
  LIMIT p_limit;
END;
$$;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE warming_member_messages IS 'Mensagens/templates configurados para cada WABA no pool de aquecimento';
COMMENT ON TABLE warming_message_executions IS 'Controle de execucao de mensagens para cada contato no aquecimento';
COMMENT ON FUNCTION schedule_warming_messages IS 'Agenda todas as mensagens do fluxo para um contato que entrou no aquecimento';
COMMENT ON FUNCTION get_pending_warming_messages IS 'Retorna mensagens pendentes prontas para envio';
