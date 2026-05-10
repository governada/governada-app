DROP FUNCTION IF EXISTS public.get_source_health_summary(INTEGER);
DROP TABLE IF EXISTS public.source_health_events;

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
        'intelligence_precompute'::TEXT,
        'passage_predictions'::TEXT
      ]
    )
  );
