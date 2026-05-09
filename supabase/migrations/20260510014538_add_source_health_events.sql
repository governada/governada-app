CREATE TABLE public.source_health_events (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('koios', 'blockfrost')),
  endpoint TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  status_code INTEGER,
  success BOOLEAN NOT NULL,
  error_class TEXT CHECK (
    error_class IS NULL
    OR error_class IN ('rate_limit', 'timeout', 'network', 'http_5xx', 'http_4xx')
  )
);

CREATE INDEX idx_source_health_recent
  ON public.source_health_events (source, started_at DESC);

CREATE INDEX idx_source_health_endpoint
  ON public.source_health_events (source, endpoint, started_at DESC);

ALTER TABLE public.source_health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "source_health_events_service_all"
  ON public.source_health_events
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.source_health_events FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.source_health_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.source_health_events_id_seq TO service_role;

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

ALTER TABLE public.sync_log
  DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;

ALTER TABLE public.sync_log
  ADD CONSTRAINT sync_log_sync_type_check CHECK (
    sync_type = ANY (
      ARRAY[
        'fast'::TEXT,
        'full'::TEXT,
        'integrity_check'::TEXT,
        'proposals'::TEXT,
        'dreps'::TEXT,
        'votes'::TEXT,
        'secondary'::TEXT,
        'slow'::TEXT,
        'treasury'::TEXT,
        'api_health_check'::TEXT,
        'scoring'::TEXT,
        'alignment'::TEXT,
        'ghi'::TEXT,
        'benchmarks'::TEXT,
        'spo_scores'::TEXT,
        'spo_votes'::TEXT,
        'cc_votes'::TEXT,
        'data_moat'::TEXT,
        'delegator_snapshots'::TEXT,
        'drep_lifecycle'::TEXT,
        'epoch_summaries'::TEXT,
        'committee_sync'::TEXT,
        'metadata_archive'::TEXT,
        'governance_epoch_stats'::TEXT,
        'catalyst'::TEXT,
        'catalyst_proposals'::TEXT,
        'catalyst_funds'::TEXT,
        'reconciliation'::TEXT,
        'sample_tier1'::TEXT,
        'tier1_sample'::TEXT,
        'tier2'::TEXT,
        'intelligence_precompute'::TEXT,
        'passage_predictions'::TEXT
      ]
    )
  );
