-- =============================================
-- FIX: Aceitar qualidade UNKNOWN na seleção de WABA
-- Data: 02/02/2026
-- =============================================

-- Atualizar a função para aceitar UNKNOWN como qualidade válida
-- (Meta não retorna mais qualidade corretamente após outubro 2025)

CREATE OR REPLACE FUNCTION select_warming_waba(pool_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_waba_id UUID;
  pool_record RECORD;
  current_hour INTEGER;
  current_day INTEGER;
  total_weight INTEGER;
  random_value INTEGER;
  cumulative_weight INTEGER := 0;
  waba_record RECORD;
BEGIN
  -- Buscar configuracoes do pool
  SELECT * INTO pool_record FROM warming_pools WHERE id = pool_id AND status = 'active';

  IF pool_record IS NULL THEN
    RETURN NULL;
  END IF;

  -- Verificar janela de tempo
  IF pool_record.time_window_enabled THEN
    current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE pool_record.timezone);
    current_day := EXTRACT(DOW FROM NOW() AT TIME ZONE pool_record.timezone);

    -- Verificar se esta dentro da janela de horario
    IF current_hour < EXTRACT(HOUR FROM pool_record.time_window_start) OR
       current_hour >= EXTRACT(HOUR FROM pool_record.time_window_end) THEN
      RETURN NULL; -- Fora da janela de tempo
    END IF;

    -- Verificar se e um dia permitido
    IF NOT (current_day = ANY(pool_record.allowed_days)) THEN
      RETURN NULL; -- Dia nao permitido
    END IF;
  END IF;

  -- Selecionar WABA baseado na estrategia
  -- NOTA: Aceita GREEN, YELLOW e UNKNOWN (Meta nao retorna qualidade corretamente desde out/2025)
  CASE pool_record.rotation_strategy
    WHEN 'round_robin' THEN
      SELECT whatsapp_account_id INTO selected_waba_id
      FROM warming_pool_members
      WHERE warming_pool_id = pool_id
        AND status = 'active'
        AND (current_quality IS NULL OR current_quality IN ('GREEN', 'YELLOW', 'UNKNOWN'))
        AND current_quality != 'RED'
        AND (messages_sent_today < COALESCE(custom_daily_limit, pool_record.daily_limit_per_waba))
      ORDER BY last_selected_at NULLS FIRST, selection_count ASC
      LIMIT 1;

    WHEN 'least_used' THEN
      SELECT whatsapp_account_id INTO selected_waba_id
      FROM warming_pool_members
      WHERE warming_pool_id = pool_id
        AND status = 'active'
        AND (current_quality IS NULL OR current_quality IN ('GREEN', 'YELLOW', 'UNKNOWN'))
        AND current_quality != 'RED'
        AND (messages_sent_today < COALESCE(custom_daily_limit, pool_record.daily_limit_per_waba))
      ORDER BY messages_sent_today ASC, last_selected_at NULLS FIRST
      LIMIT 1;

    WHEN 'quality_first' THEN
      SELECT whatsapp_account_id INTO selected_waba_id
      FROM warming_pool_members
      WHERE warming_pool_id = pool_id
        AND status = 'active'
        AND (current_quality IS NULL OR current_quality IN ('GREEN', 'YELLOW', 'UNKNOWN'))
        AND current_quality != 'RED'
        AND (messages_sent_today < COALESCE(custom_daily_limit, pool_record.daily_limit_per_waba))
      ORDER BY
        CASE current_quality WHEN 'GREEN' THEN 1 WHEN 'YELLOW' THEN 2 ELSE 3 END,
        messages_sent_today ASC
      LIMIT 1;

    WHEN 'weighted' THEN
      -- Calcular soma total dos pesos das WABAs elegiveis
      SELECT COALESCE(SUM(traffic_weight), 0) INTO total_weight
      FROM warming_pool_members
      WHERE warming_pool_id = pool_id
        AND status = 'active'
        AND (current_quality IS NULL OR current_quality IN ('GREEN', 'YELLOW', 'UNKNOWN'))
        AND current_quality != 'RED'
        AND (messages_sent_today < COALESCE(custom_daily_limit, pool_record.daily_limit_per_waba));

      IF total_weight = 0 THEN
        RETURN NULL;
      END IF;

      random_value := floor(random() * total_weight) + 1;

      FOR waba_record IN
        SELECT whatsapp_account_id, traffic_weight
        FROM warming_pool_members
        WHERE warming_pool_id = pool_id
          AND status = 'active'
          AND (current_quality IS NULL OR current_quality IN ('GREEN', 'YELLOW', 'UNKNOWN'))
          AND current_quality != 'RED'
          AND (messages_sent_today < COALESCE(custom_daily_limit, pool_record.daily_limit_per_waba))
        ORDER BY traffic_weight DESC, created_at ASC
      LOOP
        cumulative_weight := cumulative_weight + waba_record.traffic_weight;
        IF random_value <= cumulative_weight THEN
          selected_waba_id := waba_record.whatsapp_account_id;
          EXIT;
        END IF;
      END LOOP;

    ELSE -- random
      SELECT whatsapp_account_id INTO selected_waba_id
      FROM warming_pool_members
      WHERE warming_pool_id = pool_id
        AND status = 'active'
        AND (current_quality IS NULL OR current_quality IN ('GREEN', 'YELLOW', 'UNKNOWN'))
        AND current_quality != 'RED'
        AND (messages_sent_today < COALESCE(custom_daily_limit, pool_record.daily_limit_per_waba))
      ORDER BY RANDOM()
      LIMIT 1;
  END CASE;

  -- Atualizar contadores se selecionou uma WABA
  IF selected_waba_id IS NOT NULL THEN
    UPDATE warming_pool_members
    SET last_selected_at = NOW(),
        selection_count = selection_count + 1,
        updated_at = NOW()
    WHERE warming_pool_id = pool_id AND whatsapp_account_id = selected_waba_id;
  END IF;

  RETURN selected_waba_id;
END;
$$;

COMMENT ON FUNCTION select_warming_waba IS 'Seleciona a proxima WABA para envio. Aceita qualidade GREEN, YELLOW ou UNKNOWN (Meta mudou API em out/2025). Estrategias: round_robin, least_used, quality_first, weighted, random';
