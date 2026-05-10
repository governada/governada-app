CREATE OR REPLACE FUNCTION public.get_source_health_summary(input_window_minutes INTEGER)
RETURNS TABLE (
  source TEXT,
  endpoint TEXT,
  window_minutes INTEGER,
  call_count INTEGER,
  success_rate DOUBLE PRECISION,
  p50_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  error_breakdown JSONB,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
SET work_mem = '64MB'
AS $$
  SELECT
    source_health_events.source,
    source_health_events.endpoint,
    input_window_minutes AS window_minutes,
    COUNT(*)::INTEGER AS call_count,
    AVG(CASE WHEN source_health_events.success THEN 1.0 ELSE 0.0 END)::DOUBLE PRECISION AS success_rate,
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY source_health_events.latency_ms)::INTEGER, 0) AS p50_latency_ms,
    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY source_health_events.latency_ms)::INTEGER, 0) AS p95_latency_ms,
    JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
      'rate_limit', NULLIF(COUNT(*) FILTER (WHERE source_health_events.error_class = 'rate_limit'), 0),
      'timeout', NULLIF(COUNT(*) FILTER (WHERE source_health_events.error_class = 'timeout'), 0),
      'network', NULLIF(COUNT(*) FILTER (WHERE source_health_events.error_class = 'network'), 0),
      'http_5xx', NULLIF(COUNT(*) FILTER (WHERE source_health_events.error_class = 'http_5xx'), 0),
      'http_4xx', NULLIF(COUNT(*) FILTER (WHERE source_health_events.error_class = 'http_4xx'), 0)
    )) AS error_breakdown,
    MAX(source_health_events.started_at) FILTER (WHERE source_health_events.success) AS last_success_at,
    MAX(source_health_events.started_at) FILTER (WHERE NOT source_health_events.success) AS last_failure_at
  FROM public.source_health_events
  WHERE source_health_events.started_at >= NOW() - MAKE_INTERVAL(mins => input_window_minutes)
  GROUP BY source_health_events.source, source_health_events.endpoint
  ORDER BY source_health_events.source, source_health_events.endpoint;
$$;

GRANT EXECUTE ON FUNCTION public.get_source_health_summary(INTEGER) TO service_role;
