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
AS $$
  WITH filtered AS (
    SELECT *
    FROM public.source_health_events
    WHERE started_at >= NOW() - MAKE_INTERVAL(mins => input_window_minutes)
  ),
  base AS (
    SELECT
      source,
      endpoint,
      COUNT(*)::INTEGER AS call_count,
      AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END)::DOUBLE PRECISION AS success_rate,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms)::INTEGER AS p50_latency_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INTEGER AS p95_latency_ms,
      MAX(started_at) FILTER (WHERE success) AS last_success_at,
      MAX(started_at) FILTER (WHERE NOT success) AS last_failure_at
    FROM filtered
    GROUP BY source, endpoint
  ),
  error_counts AS (
    SELECT
      source,
      endpoint,
      JSONB_OBJECT_AGG(error_class, error_count) AS error_breakdown
    FROM (
      SELECT source, endpoint, error_class, COUNT(*)::INTEGER AS error_count
      FROM filtered
      WHERE error_class IS NOT NULL
      GROUP BY source, endpoint, error_class
    ) counted_errors
    GROUP BY source, endpoint
  )
  SELECT
    base.source,
    base.endpoint,
    input_window_minutes AS window_minutes,
    base.call_count,
    COALESCE(base.success_rate, 0) AS success_rate,
    COALESCE(base.p50_latency_ms, 0) AS p50_latency_ms,
    COALESCE(base.p95_latency_ms, 0) AS p95_latency_ms,
    COALESCE(error_counts.error_breakdown, '{}'::JSONB) AS error_breakdown,
    base.last_success_at,
    base.last_failure_at
  FROM base
  LEFT JOIN error_counts
    ON error_counts.source = base.source
   AND error_counts.endpoint = base.endpoint
  ORDER BY base.source, base.endpoint;
$$;

GRANT EXECUTE ON FUNCTION public.get_source_health_summary(INTEGER) TO service_role;
