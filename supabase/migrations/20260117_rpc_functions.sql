-- =============================================
-- RPC FUNCTIONS PARA DASHBOARD
-- =============================================

-- Mensagens por dia (últimos 7 dias)
CREATE OR REPLACE FUNCTION get_messages_per_day(org_id UUID)
RETURNS TABLE (
  date DATE,
  sent BIGINT,
  received BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(m.created_at) as date,
    COUNT(*) FILTER (WHERE m.direction = 'outbound') as sent,
    COUNT(*) FILTER (WHERE m.direction = 'inbound') as received
  FROM messages m
  JOIN conversations c ON m.conversation_id = c.id
  JOIN contacts ct ON c.contact_id = ct.id
  WHERE ct.organization_id = org_id
    AND m.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY DATE(m.created_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Distribuição de status de mensagens
CREATE OR REPLACE FUNCTION get_message_status_distribution(org_id UUID)
RETURNS TABLE (
  status TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(m.status, 'sent') as status,
    COUNT(*) as count
  FROM messages m
  JOIN conversations c ON m.conversation_id = c.id
  JOIN contacts ct ON c.contact_id = ct.id
  WHERE ct.organization_id = org_id
    AND m.direction = 'outbound'
    AND m.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY m.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atividade recente
CREATE OR REPLACE FUNCTION get_recent_activity(org_id UUID, limit_count INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    'message'::TEXT as type,
    CASE
      WHEN m.direction = 'inbound' THEN 'Mensagem recebida de ' || COALESCE(ct.name, ct.phone_number)
      ELSE 'Mensagem enviada para ' || COALESCE(ct.name, ct.phone_number)
    END as description,
    m.created_at
  FROM messages m
  JOIN conversations c ON m.conversation_id = c.id
  JOIN contacts ct ON c.contact_id = ct.id
  WHERE ct.organization_id = org_id
  ORDER BY m.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conversas pendentes
CREATE OR REPLACE FUNCTION get_pending_conversations(org_id UUID)
RETURNS TABLE (
  id UUID,
  contact_name TEXT,
  contact_phone TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    COALESCE(ct.name, 'Sem nome')::TEXT as contact_name,
    ct.phone_number::TEXT as contact_phone,
    c.last_message::TEXT,
    c.last_message_at,
    COALESCE(c.unread_count, 0)::BIGINT as unread_count
  FROM conversations c
  JOIN contacts ct ON c.contact_id = ct.id
  WHERE ct.organization_id = org_id
    AND c.status = 'pending'
  ORDER BY c.last_message_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Top fluxos executados
CREATE OR REPLACE FUNCTION get_top_flows(org_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  executions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name::TEXT,
    COUNT(fe.id) as executions
  FROM flows f
  LEFT JOIN flow_executions fe ON f.id = fe.flow_id
  WHERE f.organization_id = org_id
  GROUP BY f.id, f.name
  ORDER BY executions DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION get_messages_per_day(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_status_distribution(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_activity(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_flows(UUID) TO authenticated;
