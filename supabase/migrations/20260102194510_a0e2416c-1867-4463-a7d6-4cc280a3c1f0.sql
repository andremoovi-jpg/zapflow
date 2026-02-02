-- Queue Metrics Table (snapshots of queue state)
CREATE TABLE queue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id UUID REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  
  -- Queue snapshot
  waiting INTEGER DEFAULT 0,
  active INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  delayed INTEGER DEFAULT 0,
  
  -- Performance
  throughput_per_second DECIMAL(10,2) DEFAULT 0,
  avg_processing_time_ms INTEGER DEFAULT 0,
  
  -- Timestamp
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_metrics_waba ON queue_metrics(whatsapp_account_id);
CREATE INDEX idx_queue_metrics_time ON queue_metrics(recorded_at DESC);

-- Enable RLS
ALTER TABLE queue_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view queue metrics of their WABAs"
ON queue_metrics FOR SELECT
USING (
  whatsapp_account_id IN (
    SELECT id FROM whatsapp_accounts 
    WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "System can insert queue metrics"
ON queue_metrics FOR INSERT
WITH CHECK (
  whatsapp_account_id IN (
    SELECT id FROM whatsapp_accounts 
    WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Phone Number Metrics Table
CREATE TABLE phone_number_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE CASCADE,
  
  -- Period
  period_start TIMESTAMPTZ NOT NULL,
  period_type VARCHAR(20) NOT NULL, -- minute, hour, day
  
  -- Counters
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_read INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  
  -- Performance
  avg_delivery_time_ms INTEGER,
  max_throughput_achieved DECIMAL(10,2),
  
  -- Rate limit
  rate_limit_hits INTEGER DEFAULT 0,
  
  UNIQUE(phone_number_id, period_start, period_type)
);

CREATE INDEX idx_phone_metrics_number ON phone_number_metrics(phone_number_id);
CREATE INDEX idx_phone_metrics_period ON phone_number_metrics(period_start DESC);

-- Enable RLS
ALTER TABLE phone_number_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view phone number metrics"
ON phone_number_metrics FOR SELECT
USING (
  phone_number_id IN (
    SELECT pn.id FROM phone_numbers pn
    JOIN whatsapp_accounts wa ON pn.whatsapp_account_id = wa.id
    WHERE wa.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "System can insert phone number metrics"
ON phone_number_metrics FOR INSERT
WITH CHECK (
  phone_number_id IN (
    SELECT pn.id FROM phone_numbers pn
    JOIN whatsapp_accounts wa ON pn.whatsapp_account_id = wa.id
    WHERE wa.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Function to get queue status for a WABA
CREATE OR REPLACE FUNCTION get_queue_status(waba_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'latest', (
      SELECT json_build_object(
        'waiting', waiting,
        'active', active,
        'completed', completed,
        'failed', failed,
        'delayed', delayed,
        'throughput', throughput_per_second,
        'avgProcessingTime', avg_processing_time_ms,
        'recordedAt', recorded_at
      )
      FROM queue_metrics
      WHERE whatsapp_account_id = waba_id
      ORDER BY recorded_at DESC
      LIMIT 1
    ),
    'history', (
      SELECT json_agg(metrics ORDER BY recorded_at ASC)
      FROM (
        SELECT 
          recorded_at,
          throughput_per_second as throughput,
          waiting,
          active,
          completed,
          failed
        FROM queue_metrics
        WHERE whatsapp_account_id = waba_id
        AND recorded_at >= NOW() - INTERVAL '5 minutes'
        ORDER BY recorded_at ASC
      ) metrics
    ),
    'todayStats', (
      SELECT json_build_object(
        'totalCompleted', COALESCE(SUM(completed), 0),
        'totalFailed', COALESCE(SUM(failed), 0),
        'avgThroughput', COALESCE(AVG(throughput_per_second), 0),
        'maxThroughput', COALESCE(MAX(throughput_per_second), 0)
      )
      FROM queue_metrics
      WHERE whatsapp_account_id = waba_id
      AND recorded_at >= CURRENT_DATE
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to get phone number performance
CREATE OR REPLACE FUNCTION get_phone_performance(phone_id uuid, period_type_param varchar DEFAULT 'hour')
RETURNS json
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
        'totalSent', COALESCE(SUM(messages_sent), 0),
        'totalDelivered', COALESCE(SUM(messages_delivered), 0),
        'totalRead', COALESCE(SUM(messages_read), 0),
        'totalFailed', COALESCE(SUM(messages_failed), 0),
        'avgDeliveryTime', COALESCE(AVG(avg_delivery_time_ms), 0),
        'maxThroughput', COALESCE(MAX(max_throughput_achieved), 0),
        'rateLimitHits', COALESCE(SUM(rate_limit_hits), 0)
      )
      FROM phone_number_metrics
      WHERE phone_number_id = phone_id
      AND period_type = period_type_param
      AND period_start >= CURRENT_DATE
    ),
    'history', (
      SELECT json_agg(metrics ORDER BY period_start ASC)
      FROM (
        SELECT 
          period_start,
          messages_sent,
          messages_delivered,
          messages_failed,
          max_throughput_achieved as throughput
        FROM phone_number_metrics
        WHERE phone_number_id = phone_id
        AND period_type = period_type_param
        AND period_start >= CURRENT_DATE - INTERVAL '24 hours'
        ORDER BY period_start ASC
      ) metrics
    )
  ) INTO result;
  
  RETURN result;
END;
$$;