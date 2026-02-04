-- =============================================
-- FIX: Ajustar fuso horário para Brasil (America/Sao_Paulo)
-- Data: 03/02/2026
-- =============================================

-- 1. Atualizar função de contagem de templates para usar timezone Brasil
CREATE OR REPLACE FUNCTION count_waba_templates_today(waba_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM messages m
  JOIN contacts c ON m.contact_id = c.id
  WHERE c.whatsapp_account_id = waba_uuid
    AND m.direction = 'outbound'
    AND m.type = 'template'
    AND m.created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

COMMENT ON FUNCTION count_waba_templates_today IS 'Conta templates enviados hoje (timezone America/Sao_Paulo)';

-- 2. Criar função para resetar contadores diários às 00:00 de São Paulo
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Resetar contadores apenas se for meia-noite em São Paulo
  IF EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo') = 0 THEN
    UPDATE warming_pool_members SET messages_sent_today = 0;
    UPDATE warming_pools SET total_messages_today = 0;
    UPDATE phone_numbers SET messages_sent_today = 0;
  END IF;
END;
$$;

COMMENT ON FUNCTION reset_daily_counters IS 'Reseta contadores diarios a meia-noite de Sao Paulo';
