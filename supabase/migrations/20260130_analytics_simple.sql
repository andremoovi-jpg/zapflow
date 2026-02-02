-- =============================================
-- ANALYTICS SIMPLES (10K msgs/dia)
-- Usa dados existentes, sem novas tabelas de eventos
-- =============================================

-- =============================================
-- 1. RPC: STATS DE CAMPANHA
-- =============================================

CREATE OR REPLACE FUNCTION get_campaign_analytics(p_campaign_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'summary', (
      SELECT json_build_object(
        'total', COUNT(*),
        'sent', COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read')),
        'delivered', COUNT(*) FILTER (WHERE status IN ('delivered', 'read')),
        'read', COUNT(*) FILTER (WHERE status = 'read'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'delivery_rate', ROUND(
          COUNT(*) FILTER (WHERE status IN ('delivered', 'read'))::numeric /
          NULLIF(COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read')), 0) * 100, 2
        ),
        'read_rate', ROUND(
          COUNT(*) FILTER (WHERE status = 'read')::numeric /
          NULLIF(COUNT(*) FILTER (WHERE status IN ('delivered', 'read')), 0) * 100, 2
        )
      )
      FROM campaign_messages
      WHERE campaign_id = p_campaign_id
    ),
    'hourly_distribution', (
      SELECT json_agg(json_build_object(
        'hour', hour,
        'sent', sent,
        'delivered', delivered,
        'read', read
      ) ORDER BY hour)
      FROM (
        SELECT
          EXTRACT(HOUR FROM sent_at) as hour,
          COUNT(*) as sent,
          COUNT(*) FILTER (WHERE status IN ('delivered', 'read')) as delivered,
          COUNT(*) FILTER (WHERE status = 'read') as read
        FROM campaign_messages
        WHERE campaign_id = p_campaign_id
          AND sent_at IS NOT NULL
        GROUP BY EXTRACT(HOUR FROM sent_at)
      ) hourly
    ),
    'errors', (
      SELECT json_agg(json_build_object(
        'error', error_message,
        'count', cnt
      ) ORDER BY cnt DESC)
      FROM (
        SELECT error_message, COUNT(*) as cnt
        FROM campaign_messages
        WHERE campaign_id = p_campaign_id
          AND status = 'failed'
          AND error_message IS NOT NULL
        GROUP BY error_message
        LIMIT 10
      ) errors
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- =============================================
-- 2. RPC: STATS DE FLUXO
-- =============================================

CREATE OR REPLACE FUNCTION get_flow_analytics(p_flow_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'summary', (
      SELECT json_build_object(
        'total_executions', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'running', COUNT(*) FILTER (WHERE status = 'running'),
        'paused', COUNT(*) FILTER (WHERE status = 'paused'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'completion_rate', ROUND(
          COUNT(*) FILTER (WHERE status = 'completed')::numeric /
          NULLIF(COUNT(*), 0) * 100, 2
        )
      )
      FROM flow_executions
      WHERE flow_id = p_flow_id
    ),
    'daily_trend', (
      SELECT json_agg(json_build_object(
        'date', date,
        'started', started,
        'completed', completed
      ) ORDER BY date DESC)
      FROM (
        SELECT
          DATE(created_at) as date,
          COUNT(*) as started,
          COUNT(*) FILTER (WHERE status = 'completed') as completed
        FROM flow_executions
        WHERE flow_id = p_flow_id
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
      ) daily
    ),
    'node_stats', (
      SELECT json_agg(json_build_object(
        'node_id', node_id,
        'node_name', node_name,
        'executions', executions,
        'avg_duration_ms', avg_duration
      ) ORDER BY executions DESC)
      FROM (
        SELECT
          fel.node_id,
          fn.data->>'label' as node_name,
          COUNT(*) as executions,
          ROUND(AVG(EXTRACT(EPOCH FROM (fel.completed_at - fel.started_at)) * 1000)) as avg_duration
        FROM flow_execution_logs fel
        JOIN flow_executions fe ON fe.id = fel.execution_id
        LEFT JOIN flow_nodes fn ON fn.id = fel.node_id
        WHERE fe.flow_id = p_flow_id
        GROUP BY fel.node_id, fn.data->>'label'
      ) nodes
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- =============================================
-- 3. RPC: STATS POR NUMERO DE TELEFONE
-- =============================================

CREATE OR REPLACE FUNCTION get_phone_performance(
  p_org_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(phone_stats ORDER BY total_sent DESC)
    FROM (
      SELECT
        pn.id as phone_number_id,
        pn.display_name,
        pn.phone_number,
        pn.quality_rating,
        wa.name as waba_name,
        COUNT(m.id) as total_sent,
        COUNT(m.id) FILTER (WHERE m.status IN ('delivered', 'read')) as total_delivered,
        COUNT(m.id) FILTER (WHERE m.status = 'read') as total_read,
        COUNT(m.id) FILTER (WHERE m.status = 'failed') as total_failed,
        ROUND(
          COUNT(m.id) FILTER (WHERE m.status IN ('delivered', 'read'))::numeric /
          NULLIF(COUNT(m.id), 0) * 100, 2
        ) as delivery_rate,
        ROUND(
          COUNT(m.id) FILTER (WHERE m.status = 'read')::numeric /
          NULLIF(COUNT(m.id) FILTER (WHERE m.status IN ('delivered', 'read')), 0) * 100, 2
        ) as read_rate
      FROM phone_numbers pn
      JOIN whatsapp_accounts wa ON wa.id = pn.whatsapp_account_id
      LEFT JOIN messages m ON m.phone_number_id = pn.phone_number_id
        AND m.direction = 'outbound'
        AND m.created_at >= NOW() - (p_days || ' days')::interval
      WHERE wa.organization_id = p_org_id
      GROUP BY pn.id, pn.display_name, pn.phone_number, pn.quality_rating, wa.name
    ) phone_stats
  );
END;
$$;

-- =============================================
-- 4. RPC: DASHBOARD GERAL
-- =============================================

CREATE OR REPLACE FUNCTION get_dashboard_analytics(
  p_org_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  start_date TIMESTAMPTZ := NOW() - (p_days || ' days')::interval;
BEGIN
  SELECT json_build_object(
    -- Resumo de mensagens
    'messages', (
      SELECT json_build_object(
        'total_sent', COUNT(*) FILTER (WHERE direction = 'outbound'),
        'total_received', COUNT(*) FILTER (WHERE direction = 'inbound'),
        'delivered', COUNT(*) FILTER (WHERE direction = 'outbound' AND status IN ('delivered', 'read')),
        'read', COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'read'),
        'failed', COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'failed')
      )
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.organization_id = p_org_id
        AND m.created_at >= start_date
    ),

    -- Resumo de campanhas
    'campaigns', (
      SELECT json_build_object(
        'total', COUNT(*),
        'running', COUNT(*) FILTER (WHERE status = 'running'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'total_messages', SUM((stats->>'total')::int),
        'total_delivered', SUM((stats->>'delivered')::int),
        'total_read', SUM((stats->>'read')::int)
      )
      FROM campaigns
      WHERE organization_id = p_org_id
        AND created_at >= start_date
    ),

    -- Resumo de fluxos
    'flows', (
      SELECT json_build_object(
        'total_active', COUNT(*) FILTER (WHERE is_active = true),
        'total_executions', (
          SELECT COUNT(*) FROM flow_executions fe
          JOIN flows f ON f.id = fe.flow_id
          WHERE f.organization_id = p_org_id
            AND fe.created_at >= start_date
        ),
        'completed_executions', (
          SELECT COUNT(*) FROM flow_executions fe
          JOIN flows f ON f.id = fe.flow_id
          WHERE f.organization_id = p_org_id
            AND fe.created_at >= start_date
            AND fe.status = 'completed'
        )
      )
      FROM flows
      WHERE organization_id = p_org_id
    ),

    -- Resumo de contatos
    'contacts', (
      SELECT json_build_object(
        'total', COUNT(*),
        'new_this_period', COUNT(*) FILTER (WHERE created_at >= start_date),
        'active_this_period', (
          SELECT COUNT(DISTINCT contact_id)
          FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          WHERE c.organization_id = p_org_id
            AND m.created_at >= start_date
        )
      )
      FROM contacts
      WHERE organization_id = p_org_id
    ),

    -- Tendencia diaria
    'daily_trend', (
      SELECT json_agg(json_build_object(
        'date', date,
        'sent', sent,
        'received', received,
        'delivered', delivered,
        'read', read
      ) ORDER BY date)
      FROM (
        SELECT
          DATE(m.created_at) as date,
          COUNT(*) FILTER (WHERE m.direction = 'outbound') as sent,
          COUNT(*) FILTER (WHERE m.direction = 'inbound') as received,
          COUNT(*) FILTER (WHERE m.direction = 'outbound' AND m.status IN ('delivered', 'read')) as delivered,
          COUNT(*) FILTER (WHERE m.direction = 'outbound' AND m.status = 'read') as read
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.organization_id = p_org_id
          AND m.created_at >= start_date
        GROUP BY DATE(m.created_at)
      ) daily
    ),

    -- Top campanhas
    'top_campaigns', (
      SELECT json_agg(json_build_object(
        'id', id,
        'name', name,
        'total', (stats->>'total')::int,
        'read_rate', ROUND(
          (stats->>'read')::numeric / NULLIF((stats->>'delivered')::numeric, 0) * 100, 2
        )
      ) ORDER BY (stats->>'total')::int DESC NULLS LAST)
      FROM (
        SELECT id, name, stats
        FROM campaigns
        WHERE organization_id = p_org_id
          AND created_at >= start_date
        LIMIT 5
      ) top
    ),

    -- Cliques em links
    'link_clicks', (
      SELECT json_build_object(
        'total_clicks', COUNT(*),
        'unique_contacts', COUNT(DISTINCT contact_id)
      )
      FROM link_clicks lc
      JOIN tracked_links tl ON tl.id = lc.tracked_link_id
      WHERE tl.organization_id = p_org_id
        AND lc.created_at >= start_date
    )

  ) INTO result;

  RETURN result;
END;
$$;

-- =============================================
-- 5. RPC: STATS DE WARMING POOL
-- =============================================

CREATE OR REPLACE FUNCTION get_warming_analytics(p_pool_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN json_build_object(
    'pool_info', (
      SELECT json_build_object(
        'name', name,
        'status', status,
        'total_messages_sent', total_messages_sent,
        'total_messages_today', total_messages_today
      )
      FROM warming_pools
      WHERE id = p_pool_id
    ),

    'members', (
      SELECT json_agg(json_build_object(
        'waba_id', wpm.whatsapp_account_id,
        'waba_name', wa.name,
        'status', wpm.status,
        'quality', wpm.current_quality,
        'messages_sent_today', wpm.messages_sent_today,
        'daily_limit', COALESCE(wpm.custom_daily_limit, wp.daily_limit_per_waba),
        'usage_percent', ROUND(
          wpm.messages_sent_today::numeric /
          NULLIF(COALESCE(wpm.custom_daily_limit, wp.daily_limit_per_waba), 0) * 100, 2
        ),
        'warmup_day', wpm.warmup_phase_day
      ) ORDER BY wpm.messages_sent_today DESC)
      FROM warming_pool_members wpm
      JOIN warming_pools wp ON wp.id = wpm.warming_pool_id
      JOIN whatsapp_accounts wa ON wa.id = wpm.whatsapp_account_id
      WHERE wpm.warming_pool_id = p_pool_id
    ),

    'recent_events', (
      SELECT json_agg(json_build_object(
        'event_type', event_type,
        'event_data', event_data,
        'severity', severity,
        'created_at', created_at
      ) ORDER BY created_at DESC)
      FROM (
        SELECT event_type, event_data, severity, created_at
        FROM warming_events_log
        WHERE warming_pool_id = p_pool_id
        ORDER BY created_at DESC
        LIMIT 20
      ) recent
    ),

    'contacts_summary', (
      SELECT json_build_object(
        'total', COUNT(*),
        'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'replied', COUNT(*) FILTER (WHERE has_replied = true)
      )
      FROM warming_contact_history
      WHERE warming_pool_id = p_pool_id
    )
  );
END;
$$;

-- =============================================
-- GRANTS
-- =============================================

GRANT EXECUTE ON FUNCTION get_campaign_analytics(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_flow_analytics(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_phone_performance(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_dashboard_analytics(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_warming_analytics(UUID) TO authenticated, service_role;

-- =============================================
-- COMENTARIOS
-- =============================================

COMMENT ON FUNCTION get_campaign_analytics IS 'Retorna analytics de uma campanha especifica';
COMMENT ON FUNCTION get_flow_analytics IS 'Retorna analytics de um fluxo especifico';
COMMENT ON FUNCTION get_phone_performance IS 'Retorna performance de todos os numeros da organizacao';
COMMENT ON FUNCTION get_dashboard_analytics IS 'Retorna metricas gerais do dashboard';
COMMENT ON FUNCTION get_warming_analytics IS 'Retorna analytics de um pool de aquecimento';

-- =============================================
-- 6. RPC: STATS POR NO DO FLUXO (para editor visual)
-- =============================================

CREATE OR REPLACE FUNCTION get_flow_node_stats(p_flow_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_object_agg(
      node_id,
      json_build_object(
        'entered', entered,
        'completed', completed,
        'failed', failed,
        'completion_rate', ROUND(completed::numeric / NULLIF(entered, 0) * 100, 1),
        'button_clicks', button_clicks,
        'avg_time_ms', avg_time_ms
      )
    )
    FROM (
      SELECT
        fel.node_id,
        COUNT(*) as entered,
        COUNT(*) FILTER (WHERE fel.status = 'completed') as completed,
        COUNT(*) FILTER (WHERE fel.status = 'failed') as failed,
        ROUND(AVG(EXTRACT(EPOCH FROM (fel.completed_at - fel.started_at)) * 1000)) as avg_time_ms,
        -- Agregar cliques por botao
        (
          SELECT json_object_agg(button_id, click_count)
          FROM (
            SELECT
              ae.event_data->>'button_id' as button_id,
              COUNT(*) as click_count
            FROM analytics_events ae
            WHERE ae.source_type = 'flow'
              AND ae.source_id = p_flow_id
              AND ae.source_node_id = fel.node_id
              AND ae.event_type = 'engagement.button_click'
            GROUP BY ae.event_data->>'button_id'
          ) btn
        ) as button_clicks
      FROM flow_execution_logs fel
      JOIN flow_executions fe ON fe.id = fel.execution_id
      WHERE fe.flow_id = p_flow_id
      GROUP BY fel.node_id
    ) node_stats
  );
END;
$$;

-- Versao alternativa que funciona sem analytics_events (usa dados existentes)
CREATE OR REPLACE FUNCTION get_flow_node_stats_simple(p_flow_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_object_agg(
      node_id,
      json_build_object(
        'entered', entered,
        'completed', completed,
        'failed', failed,
        'completion_rate', ROUND(completed::numeric / NULLIF(entered, 0) * 100, 1)
      )
    )
    FROM (
      SELECT
        fel.node_id,
        COUNT(*) as entered,
        COUNT(*) FILTER (WHERE fel.status = 'completed') as completed,
        COUNT(*) FILTER (WHERE fel.status = 'failed') as failed
      FROM flow_execution_logs fel
      JOIN flow_executions fe ON fe.id = fel.execution_id
      WHERE fe.flow_id = p_flow_id
        AND fe.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY fel.node_id
    ) node_stats
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_flow_node_stats(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_flow_node_stats_simple(UUID) TO authenticated, service_role;
