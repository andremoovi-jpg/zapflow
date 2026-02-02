
-- Dashboard metrics function
CREATE OR REPLACE FUNCTION get_dashboard_metrics(org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'messages_today', (
      SELECT COUNT(*) FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.organization_id = org_id
      AND m.created_at >= CURRENT_DATE
    ),
    'messages_yesterday', (
      SELECT COUNT(*) FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.organization_id = org_id
      AND m.created_at >= CURRENT_DATE - INTERVAL '1 day'
      AND m.created_at < CURRENT_DATE
    ),
    'active_contacts', (
      SELECT COUNT(*) FROM contacts
      WHERE organization_id = org_id
      AND last_interaction_at >= NOW() - INTERVAL '7 days'
    ),
    'active_flows', (
      SELECT COUNT(*) FROM flows
      WHERE organization_id = org_id
      AND is_active = true
    ),
    'delivery_rate', (
      SELECT COALESCE(
        ROUND(
          COUNT(*) FILTER (WHERE status IN ('delivered', 'read'))::DECIMAL /
          NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0) * 100,
          1
        ),
        0
      )
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.organization_id = org_id
      AND m.direction = 'outbound'
      AND m.created_at >= NOW() - INTERVAL '7 days'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Messages per day for chart (last 30 days)
CREATE OR REPLACE FUNCTION get_messages_per_day(org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(daily_data ORDER BY day)
  INTO result
  FROM (
    SELECT 
      d.day::date as day,
      COALESCE(sent.count, 0) as sent,
      COALESCE(received.count, 0) as received
    FROM generate_series(
      CURRENT_DATE - INTERVAL '29 days',
      CURRENT_DATE,
      '1 day'
    ) d(day)
    LEFT JOIN (
      SELECT DATE(m.created_at) as day, COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.organization_id = org_id
      AND m.direction = 'outbound'
      AND m.created_at >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY DATE(m.created_at)
    ) sent ON d.day::date = sent.day
    LEFT JOIN (
      SELECT DATE(m.created_at) as day, COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.organization_id = org_id
      AND m.direction = 'inbound'
      AND m.created_at >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY DATE(m.created_at)
    ) received ON d.day::date = received.day
  ) daily_data;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Top flows by executions
CREATE OR REPLACE FUNCTION get_top_flows(org_id UUID, limit_count INTEGER DEFAULT 5)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(flow_data)
  INTO result
  FROM (
    SELECT 
      f.id,
      f.name,
      COALESCE(f.total_executions, 0) as executions
    FROM flows f
    WHERE f.organization_id = org_id
    ORDER BY f.total_executions DESC NULLS LAST
    LIMIT limit_count
  ) flow_data;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Message status distribution
CREATE OR REPLACE FUNCTION get_message_status_distribution(org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(status_data)
  INTO result
  FROM (
    SELECT 
      CASE 
        WHEN m.status = 'read' THEN 'Lidas'
        WHEN m.status = 'delivered' THEN 'Entregues'
        WHEN m.status = 'sent' THEN 'Enviadas'
        WHEN m.status = 'failed' THEN 'Falhas'
        ELSE 'Pendentes'
      END as name,
      COUNT(*) as value
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.organization_id = org_id
    AND m.direction = 'outbound'
    AND m.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY 
      CASE 
        WHEN m.status = 'read' THEN 'Lidas'
        WHEN m.status = 'delivered' THEN 'Entregues'
        WHEN m.status = 'sent' THEN 'Enviadas'
        WHEN m.status = 'failed' THEN 'Falhas'
        ELSE 'Pendentes'
      END
  ) status_data;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Recent activity
CREATE OR REPLACE FUNCTION get_recent_activity(org_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(activity ORDER BY created_at DESC)
  INTO result
  FROM (
    -- New conversations
    SELECT 
      'conversation' as type,
      c.id,
      COALESCE(ct.name, ct.phone_number) as title,
      'Nova conversa iniciada' as description,
      c.created_at
    FROM conversations c
    JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.organization_id = org_id
    AND c.created_at >= NOW() - INTERVAL '24 hours'
    
    UNION ALL
    
    -- Flow executions
    SELECT 
      'flow' as type,
      fe.id,
      f.name as title,
      'Fluxo executado' as description,
      fe.started_at as created_at
    FROM flow_executions fe
    JOIN flows f ON fe.flow_id = f.id
    WHERE f.organization_id = org_id
    AND fe.started_at >= NOW() - INTERVAL '24 hours'
    
    UNION ALL
    
    -- Campaign updates
    SELECT 
      'campaign' as type,
      cp.id,
      cp.name as title,
      CASE cp.status
        WHEN 'running' THEN 'Campanha em andamento'
        WHEN 'completed' THEN 'Campanha concluída'
        ELSE 'Campanha atualizada'
      END as description,
      cp.updated_at as created_at
    FROM campaigns cp
    WHERE cp.organization_id = org_id
    AND cp.updated_at >= NOW() - INTERVAL '24 hours'
    
    ORDER BY created_at DESC
    LIMIT limit_count
  ) activity;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Pending conversations
CREATE OR REPLACE FUNCTION get_pending_conversations(org_id UUID, hours_threshold INTEGER DEFAULT 2)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(pending ORDER BY last_message_at ASC)
  INTO result
  FROM (
    SELECT 
      c.id,
      COALESCE(ct.name, ct.phone_number) as contact_name,
      ct.phone_number,
      c.last_message_at,
      c.unread_count,
      EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 3600 as hours_waiting
    FROM conversations c
    JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.organization_id = org_id
    AND c.status = 'open'
    AND c.last_message_direction = 'inbound'
    AND c.last_message_at < NOW() - (hours_threshold || ' hours')::interval
    ORDER BY c.last_message_at ASC
    LIMIT 10
  ) pending;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;
