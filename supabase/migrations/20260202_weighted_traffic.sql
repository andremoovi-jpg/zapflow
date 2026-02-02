-- =============================================
-- WEIGHTED TRAFFIC DISTRIBUTION
-- Distribuição de tráfego por peso/porcentagem
-- Data: 02/02/2026
-- =============================================

-- 1. Adicionar campo traffic_weight na tabela warming_pool_members
ALTER TABLE warming_pool_members
ADD COLUMN IF NOT EXISTS traffic_weight INTEGER DEFAULT 100;

COMMENT ON COLUMN warming_pool_members.traffic_weight IS
'Peso do trafego em porcentagem (ex: 40 = 40% do trafego). Soma dos pesos e normalizada automaticamente.';

-- 2. Atualizar a função select_warming_waba com distribuição real por peso
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
  CASE pool_record.rotation_strategy
    WHEN 'round_robin' THEN
      -- Seleciona a que foi selecionada ha mais tempo
      SELECT whatsapp_account_id INTO selected_waba_id
      FROM warming_pool_members
      WHERE warming_pool_id = pool_id
        AND status = 'active'
        AND current_quality IN ('GREEN', 'YELLOW')
        AND (messages_sent_today < COALESCE(custom_daily_limit, pool_record.daily_limit_per_waba))
      ORDER BY last_selected_at NULLS FIRST, selection_count ASC
      LIMIT 1;

    WHEN 'least_used' THEN
      -- Seleciona a que enviou menos mensagens hoje
      SELECT whatsapp_account_id INTO selected_waba_id
      FROM warming_pool_members
      WHERE warming_pool_id = pool_id
        AND status = 'active'
        AND current_quality IN ('GREEN', 'YELLOW')
        AND (messages_sent_today < COALESCE(custom_daily_limit, pool_record.daily_limit_per_waba))
      ORDER BY messages_sent_today ASC, last_selected_at NULLS FIRST
      LIMIT 1;

    WHEN 'quality_first' THEN
      -- Prioriza WABAs com melhor qualidade
      SELECT whatsapp_account_id INTO selected_waba_id
      FROM warming_pool_members
      WHERE warming_pool_id = pool_id
        AND status = 'active'
        AND current_quality IN ('GREEN', 'YELLOW')
        AND (messages_sent_today < COALESCE(custom_daily_limit, pool_record.daily_limit_per_waba))
      ORDER BY
        CASE current_quality WHEN 'GREEN' THEN 1 WHEN 'YELLOW' THEN 2 ELSE 3 END,
        messages_sent_today ASC
      LIMIT 1;

    WHEN 'weighted' THEN
      -- DISTRIBUIÇÃO REAL POR PESO/PORCENTAGEM
      -- Calcular soma total dos pesos das WABAs elegíveis
      SELECT COALESCE(SUM(traffic_weight), 0) INTO total_weight
      FROM warming_pool_members
      WHERE warming_pool_id = pool_id
        AND status = 'active'
        AND current_quality IN ('GREEN', 'YELLOW')
        AND (messages_sent_today < COALESCE(custom_daily_limit, pool_record.daily_limit_per_waba));

      IF total_weight = 0 THEN
        RETURN NULL; -- Nenhuma WABA elegível
      END IF;

      -- Gerar número aleatório entre 1 e total_weight
      random_value := floor(random() * total_weight) + 1;

      -- Percorrer WABAs e selecionar baseado no peso acumulado
      -- Exemplo: [A=40, B=40, C=10, D=10] total=100
      -- random=65 -> A(1-40), B(41-80), C(81-90), D(91-100)
      -- 65 cai no intervalo de B (41-80)
      FOR waba_record IN
        SELECT whatsapp_account_id, traffic_weight
        FROM warming_pool_members
        WHERE warming_pool_id = pool_id
          AND status = 'active'
          AND current_quality IN ('GREEN', 'YELLOW')
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
        AND current_quality IN ('GREEN', 'YELLOW')
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

COMMENT ON FUNCTION select_warming_waba IS 'Seleciona a proxima WABA para envio baseado na estrategia do pool. Suporta: round_robin, least_used, quality_first, weighted (distribuicao por peso), random';
