-- Systems command center durable state
-- Replace audit-log reconstruction with first-class systems tables while
-- keeping admin_audit_log as the append-only audit trail.
-- NOTE: This legacy 072_* migration sorts before timestamped rebaseline
-- migrations on fresh preview replays. Keep guards below tolerant of tables
-- that may not exist yet.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS systems_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wallet_address TEXT NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('good', 'warning', 'critical', 'bootstrap')),
  focus_area TEXT NOT NULL,
  summary TEXT NOT NULL,
  top_risk TEXT NOT NULL,
  change_notes TEXT,
  linked_slo_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES systems_reviews(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  owner TEXT NOT NULL DEFAULT 'Founder + agents',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'blocked', 'done')),
  due_date DATE,
  linked_slo_ids TEXT[] NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_target TEXT UNIQUE,
  incident_date DATE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('incident', 'drill')),
  severity TEXT NOT NULL CHECK (severity IN ('drill', 'p0', 'p1', 'p2', 'near_miss')),
  status TEXT NOT NULL CHECK (status IN ('open', 'mitigated', 'resolved', 'follow_up_pending')),
  title TEXT NOT NULL,
  detected_by TEXT NOT NULL,
  systems_affected TEXT[] NOT NULL DEFAULT '{}',
  user_impact TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  mitigation TEXT NOT NULL,
  permanent_fix TEXT NOT NULL,
  follow_up_owner TEXT NOT NULL,
  time_to_acknowledge_minutes INTEGER,
  time_to_mitigate_minutes INTEGER,
  time_to_resolve_minutes INTEGER,
  created_by_wallet_address TEXT NOT NULL,
  updated_by_wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS systems_incident_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES systems_incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'status_changed')),
  status TEXT NOT NULL CHECK (status IN ('open', 'mitigated', 'resolved', 'follow_up_pending')),
  incident_snapshot JSONB NOT NULL,
  actor_wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems_automation_followups (
  source_key TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL CHECK (
    trigger_type IN (
      'review_discipline',
      'performance_baseline',
      'trust_surface_review',
      'drill_cadence',
      'incident_retro_followup',
      'overdue_commitment',
      'systems_action'
    )
  ),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'resolved')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  action_href TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  linked_incident_id UUID REFERENCES systems_incidents(id) ON DELETE SET NULL,
  linked_commitment_id UUID REFERENCES systems_commitments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_surfaced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS systems_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key TEXT NOT NULL UNIQUE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('manual', 'cron')),
  actor_wallet_address TEXT NOT NULL,
  request_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'good', 'warning', 'critical', 'failed')),
  summary TEXT,
  followup_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  resolved_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS systems_automation_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES systems_automation_runs(id) ON DELETE SET NULL,
  source_key TEXT NOT NULL REFERENCES systems_automation_followups(source_key) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('new', 'reminder')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  followup_updated_at TIMESTAMPTZ NOT NULL,
  critical_count INTEGER NOT NULL DEFAULT 1,
  channel_count INTEGER NOT NULL DEFAULT 0,
  channels TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  UNIQUE (run_id, source_key)
);

CREATE TABLE IF NOT EXISTS systems_performance_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('manual', 'cron')),
  wallet_address TEXT NOT NULL,
  baseline_date DATE NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('production', 'preview', 'local')),
  scenario_label TEXT NOT NULL,
  concurrency_profile TEXT NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('good', 'warning', 'critical')),
  summary TEXT NOT NULL,
  bottleneck TEXT NOT NULL,
  mitigation_owner TEXT NOT NULL,
  next_step TEXT NOT NULL,
  artifact_url TEXT,
  notes TEXT,
  api_health_p95_ms INTEGER NOT NULL,
  api_dreps_p95_ms INTEGER NOT NULL,
  api_v1_dreps_p95_ms INTEGER NOT NULL,
  governance_health_p95_ms INTEGER NOT NULL,
  error_rate_pct NUMERIC(6, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems_trust_surface_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('manual', 'cron')),
  wallet_address TEXT NOT NULL,
  review_date DATE NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('good', 'warning', 'critical')),
  linked_slo_ids TEXT[] NOT NULL DEFAULT '{}',
  reviewed_surfaces TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL,
  current_user_state TEXT NOT NULL,
  honesty_gap TEXT NOT NULL,
  next_fix TEXT NOT NULL,
  owner TEXT NOT NULL,
  artifact_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems_review_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('manual', 'cron')),
  wallet_address TEXT NOT NULL,
  review_date DATE NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('good', 'warning', 'critical', 'bootstrap')),
  focus_area TEXT NOT NULL,
  top_risk TEXT NOT NULL,
  change_notes TEXT NOT NULL,
  hardening_commitment_title TEXT NOT NULL,
  hardening_commitment_summary TEXT NOT NULL,
  commitment_owner TEXT NOT NULL,
  commitment_due_date DATE,
  linked_slo_ids TEXT[] NOT NULL DEFAULT '{}',
  linked_incident_id UUID REFERENCES systems_incidents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems_journey_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id TEXT NOT NULL,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('ci', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  wallet_address TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  job_name TEXT,
  commit_sha TEXT,
  run_url TEXT,
  executed_at TIMESTAMPTZ NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE systems_commitments
  ADD COLUMN IF NOT EXISTS linked_incident_id UUID REFERENCES systems_incidents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_systems_incidents_last_event_at
  ON systems_incidents(last_event_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_incidents_status
  ON systems_incidents(status, last_event_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_reviews_reviewed_at
  ON systems_reviews(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_reviews_status
  ON systems_reviews(overall_status, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_commitments_status
  ON systems_commitments(status, due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_systems_commitments_review
  ON systems_commitments(review_id);
CREATE INDEX IF NOT EXISTS idx_systems_commitments_due
  ON systems_commitments(due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_systems_incident_events_incident
  ON systems_incident_events(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_automation_followups_status
  ON systems_automation_followups(status, severity, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_automation_runs_started_at
  ON systems_automation_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_automation_escalations_source
  ON systems_automation_escalations(source_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_performance_baselines_created_at
  ON systems_performance_baselines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_trust_surface_reviews_created_at
  ON systems_trust_surface_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_review_drafts_created_at
  ON systems_review_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_journey_verifications_journey
  ON systems_journey_verifications(journey_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_commitments_linked_incident
  ON systems_commitments(linked_incident_id);

DROP TRIGGER IF EXISTS set_systems_incidents_updated_at ON systems_incidents;
CREATE TRIGGER set_systems_incidents_updated_at
  BEFORE UPDATE ON systems_incidents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_systems_commitments_updated_at ON systems_commitments;
CREATE TRIGGER set_systems_commitments_updated_at
  BEFORE UPDATE ON systems_commitments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_systems_automation_followups_updated_at ON systems_automation_followups;
CREATE TRIGGER set_systems_automation_followups_updated_at
  BEFORE UPDATE ON systems_automation_followups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE systems_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_automation_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_automation_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_performance_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_trust_surface_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_review_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_journey_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS systems_reviews_service_role_full_access ON systems_reviews;
CREATE POLICY "systems_reviews_service_role_full_access"
  ON systems_reviews FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS systems_commitments_service_role_full_access ON systems_commitments;
CREATE POLICY "systems_commitments_service_role_full_access"
  ON systems_commitments FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS systems_incidents_service_role_full_access ON systems_incidents;
CREATE POLICY "systems_incidents_service_role_full_access"
  ON systems_incidents FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS systems_incident_events_service_role_full_access ON systems_incident_events;
CREATE POLICY "systems_incident_events_service_role_full_access"
  ON systems_incident_events FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS systems_automation_followups_service_role_full_access ON systems_automation_followups;
CREATE POLICY "systems_automation_followups_service_role_full_access"
  ON systems_automation_followups FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS systems_automation_runs_service_role_full_access ON systems_automation_runs;
CREATE POLICY "systems_automation_runs_service_role_full_access"
  ON systems_automation_runs FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS systems_automation_escalations_service_role_full_access ON systems_automation_escalations;
CREATE POLICY "systems_automation_escalations_service_role_full_access"
  ON systems_automation_escalations FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS systems_performance_baselines_service_role_full_access ON systems_performance_baselines;
CREATE POLICY "systems_performance_baselines_service_role_full_access"
  ON systems_performance_baselines FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS systems_trust_surface_reviews_service_role_full_access ON systems_trust_surface_reviews;
CREATE POLICY "systems_trust_surface_reviews_service_role_full_access"
  ON systems_trust_surface_reviews FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS systems_review_drafts_service_role_full_access ON systems_review_drafts;
CREATE POLICY "systems_review_drafts_service_role_full_access"
  ON systems_review_drafts FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS systems_journey_verifications_service_role_full_access ON systems_journey_verifications;
CREATE POLICY "systems_journey_verifications_service_role_full_access"
  ON systems_journey_verifications FOR ALL
  USING (auth.role() = 'service_role');

DO $systems_backfill$
BEGIN
IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
WITH latest_incidents AS (
  SELECT DISTINCT ON (target)
    target,
    created_at,
    wallet_address,
    payload
  FROM admin_audit_log
  WHERE action = 'log_systems_incident'
    AND target IS NOT NULL
    AND payload IS NOT NULL
  ORDER BY target, created_at DESC
)
INSERT INTO systems_incidents (
  legacy_target,
  incident_date,
  entry_type,
  severity,
  status,
  title,
  detected_by,
  systems_affected,
  user_impact,
  root_cause,
  mitigation,
  permanent_fix,
  follow_up_owner,
  time_to_acknowledge_minutes,
  time_to_mitigate_minutes,
  time_to_resolve_minutes,
  created_by_wallet_address,
  updated_by_wallet_address,
  created_at,
  updated_at,
  last_event_at,
  closed_at
)
SELECT
  latest_incidents.target,
  (latest_incidents.payload ->> 'incidentDate')::date,
  latest_incidents.payload ->> 'entryType',
  latest_incidents.payload ->> 'severity',
  latest_incidents.payload ->> 'status',
  latest_incidents.payload ->> 'title',
  latest_incidents.payload ->> 'detectedBy',
  COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(latest_incidents.payload -> 'systemsAffected')),
    '{}'
  ),
  latest_incidents.payload ->> 'userImpact',
  latest_incidents.payload ->> 'rootCause',
  latest_incidents.payload ->> 'mitigation',
  latest_incidents.payload ->> 'permanentFix',
  latest_incidents.payload ->> 'followUpOwner',
  NULLIF(latest_incidents.payload ->> 'timeToAcknowledgeMinutes', '')::integer,
  NULLIF(latest_incidents.payload ->> 'timeToMitigateMinutes', '')::integer,
  NULLIF(latest_incidents.payload ->> 'timeToResolveMinutes', '')::integer,
  latest_incidents.wallet_address,
  latest_incidents.wallet_address,
  latest_incidents.created_at,
  latest_incidents.created_at,
  latest_incidents.created_at,
  CASE
    WHEN latest_incidents.payload ->> 'status' = 'resolved' THEN latest_incidents.created_at
    ELSE NULL
  END
FROM latest_incidents
WHERE latest_incidents.payload ? 'incidentDate'
  AND latest_incidents.payload ? 'entryType'
  AND latest_incidents.payload ? 'severity'
  AND latest_incidents.payload ? 'status'
  AND latest_incidents.payload ? 'title'
ON CONFLICT (legacy_target) DO UPDATE
SET
  incident_date = EXCLUDED.incident_date,
  entry_type = EXCLUDED.entry_type,
  severity = EXCLUDED.severity,
  status = EXCLUDED.status,
  title = EXCLUDED.title,
  detected_by = EXCLUDED.detected_by,
  systems_affected = EXCLUDED.systems_affected,
  user_impact = EXCLUDED.user_impact,
  root_cause = EXCLUDED.root_cause,
  mitigation = EXCLUDED.mitigation,
  permanent_fix = EXCLUDED.permanent_fix,
  follow_up_owner = EXCLUDED.follow_up_owner,
  time_to_acknowledge_minutes = EXCLUDED.time_to_acknowledge_minutes,
  time_to_mitigate_minutes = EXCLUDED.time_to_mitigate_minutes,
  time_to_resolve_minutes = EXCLUDED.time_to_resolve_minutes,
  updated_by_wallet_address = EXCLUDED.updated_by_wallet_address,
  updated_at = GREATEST(systems_incidents.updated_at, EXCLUDED.updated_at),
  last_event_at = GREATEST(systems_incidents.last_event_at, EXCLUDED.last_event_at),
  closed_at = COALESCE(EXCLUDED.closed_at, systems_incidents.closed_at);

INSERT INTO systems_incident_events (
  incident_id,
  event_type,
  status,
  incident_snapshot,
  actor_wallet_address,
  created_at
)
SELECT
  incidents.id,
  CASE
    WHEN row_number() OVER (PARTITION BY audit.target ORDER BY audit.created_at ASC) = 1 THEN 'created'
    WHEN lag(audit.payload ->> 'status') OVER (PARTITION BY audit.target ORDER BY audit.created_at ASC)
      IS DISTINCT FROM audit.payload ->> 'status' THEN 'status_changed'
    ELSE 'updated'
  END,
  audit.payload ->> 'status',
  audit.payload::jsonb,
  audit.wallet_address,
  audit.created_at
FROM admin_audit_log audit
JOIN systems_incidents incidents
  ON incidents.legacy_target = audit.target
WHERE audit.action = 'log_systems_incident'
  AND audit.payload IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM systems_incident_events existing
    WHERE existing.incident_id = incidents.id
      AND existing.created_at = audit.created_at
      AND existing.actor_wallet_address = audit.wallet_address
  );

WITH latest_followups AS (
  SELECT DISTINCT ON (COALESCE(payload ->> 'sourceKey', target))
    COALESCE(payload ->> 'sourceKey', target) AS source_key,
    payload,
    created_at
  FROM admin_audit_log
  WHERE action = 'systems_automation_followup_sync'
    AND payload IS NOT NULL
  ORDER BY COALESCE(payload ->> 'sourceKey', target), created_at DESC
)
INSERT INTO systems_automation_followups (
  source_key,
  trigger_type,
  severity,
  status,
  title,
  summary,
  recommended_action,
  action_href,
  evidence,
  created_at,
  updated_at,
  first_opened_at,
  last_surfaced_at,
  acknowledged_at,
  resolved_at
)
SELECT
  latest_followups.source_key,
  latest_followups.payload ->> 'triggerType',
  latest_followups.payload ->> 'severity',
  latest_followups.payload ->> 'status',
  latest_followups.payload ->> 'title',
  latest_followups.payload ->> 'summary',
  latest_followups.payload ->> 'recommendedAction',
  NULLIF(latest_followups.payload ->> 'actionHref', ''),
  COALESCE(latest_followups.payload -> 'evidence', '{}'::jsonb),
  latest_followups.created_at,
  latest_followups.created_at,
  COALESCE(
    (
      SELECT MIN(opened.created_at)
      FROM admin_audit_log opened
      WHERE opened.action = 'systems_automation_followup_sync'
        AND COALESCE(opened.payload ->> 'sourceKey', opened.target) = latest_followups.source_key
        AND opened.payload ->> 'status' = 'open'
    ),
    latest_followups.created_at
  ),
  latest_followups.created_at,
  (
    SELECT MAX(ack.created_at)
    FROM admin_audit_log ack
    WHERE ack.action = 'systems_automation_followup_sync'
      AND COALESCE(ack.payload ->> 'sourceKey', ack.target) = latest_followups.source_key
      AND ack.payload ->> 'status' = 'acknowledged'
  ),
  (
    SELECT MAX(resolved.created_at)
    FROM admin_audit_log resolved
    WHERE resolved.action = 'systems_automation_followup_sync'
      AND COALESCE(resolved.payload ->> 'sourceKey', resolved.target) = latest_followups.source_key
      AND resolved.payload ->> 'status' = 'resolved'
  )
FROM latest_followups
WHERE latest_followups.source_key IS NOT NULL
ON CONFLICT (source_key) DO UPDATE
SET
  trigger_type = EXCLUDED.trigger_type,
  severity = EXCLUDED.severity,
  status = EXCLUDED.status,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  recommended_action = EXCLUDED.recommended_action,
  action_href = EXCLUDED.action_href,
  evidence = EXCLUDED.evidence,
  updated_at = GREATEST(systems_automation_followups.updated_at, EXCLUDED.updated_at),
  last_surfaced_at = GREATEST(
    systems_automation_followups.last_surfaced_at,
    EXCLUDED.last_surfaced_at
  ),
  acknowledged_at = COALESCE(EXCLUDED.acknowledged_at, systems_automation_followups.acknowledged_at),
  resolved_at = COALESCE(EXCLUDED.resolved_at, systems_automation_followups.resolved_at);

INSERT INTO systems_automation_runs (
  run_key,
  actor_type,
  actor_wallet_address,
  status,
  summary,
  followup_count,
  critical_count,
  opened_count,
  updated_count,
  resolved_count,
  started_at,
  completed_at
)
SELECT
  'legacy:' || created_at::text,
  payload ->> 'actorType',
  wallet_address,
  payload ->> 'status',
  payload ->> 'summary',
  COALESCE(NULLIF(payload ->> 'followupCount', '')::integer, 0),
  COALESCE(NULLIF(payload ->> 'criticalCount', '')::integer, 0),
  COALESCE(NULLIF(payload ->> 'openedCount', '')::integer, 0),
  COALESCE(NULLIF(payload ->> 'updatedCount', '')::integer, 0),
  COALESCE(NULLIF(payload ->> 'resolvedCount', '')::integer, 0),
  created_at,
  created_at
FROM admin_audit_log
WHERE action = 'systems_automation_sweep'
  AND payload IS NOT NULL
ON CONFLICT (run_key) DO NOTHING;

INSERT INTO systems_automation_escalations (
  run_id,
  source_key,
  reason,
  status,
  title,
  details,
  followup_updated_at,
  critical_count,
  channel_count,
  channels,
  created_at,
  delivered_at
)
SELECT
  NULL,
  source_keys.source_key,
  'new',
  CASE WHEN audit.payload ->> 'status' = 'sent' THEN 'sent' ELSE 'failed' END,
  audit.payload ->> 'title',
  audit.payload ->> 'details',
  audit.created_at,
  COALESCE(NULLIF(audit.payload ->> 'criticalCount', '')::integer, 1),
  COALESCE(NULLIF(audit.payload ->> 'channelCount', '')::integer, 0),
  COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(audit.payload -> 'channels')),
    '{}'
  ),
  audit.created_at,
  CASE WHEN audit.payload ->> 'status' = 'sent' THEN audit.created_at ELSE NULL END
FROM admin_audit_log audit
CROSS JOIN LATERAL (
  SELECT jsonb_array_elements_text(audit.payload -> 'followupSourceKeys') AS source_key
) source_keys
WHERE audit.action = 'systems_operator_escalation'
  AND audit.payload IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM systems_automation_escalations existing
    WHERE existing.source_key = source_keys.source_key
      AND existing.created_at = audit.created_at
      AND existing.status = CASE WHEN audit.payload ->> 'status' = 'sent' THEN 'sent' ELSE 'failed' END
  );

INSERT INTO systems_performance_baselines (
  actor_type,
  wallet_address,
  baseline_date,
  environment,
  scenario_label,
  concurrency_profile,
  overall_status,
  summary,
  bottleneck,
  mitigation_owner,
  next_step,
  artifact_url,
  notes,
  api_health_p95_ms,
  api_dreps_p95_ms,
  api_v1_dreps_p95_ms,
  governance_health_p95_ms,
  error_rate_pct,
  created_at
)
SELECT
  payload ->> 'actorType',
  wallet_address,
  (payload ->> 'baselineDate')::date,
  payload ->> 'environment',
  payload ->> 'scenarioLabel',
  payload ->> 'concurrencyProfile',
  payload ->> 'overallStatus',
  payload ->> 'summary',
  payload ->> 'bottleneck',
  payload ->> 'mitigationOwner',
  payload ->> 'nextStep',
  NULLIF(payload ->> 'artifactUrl', ''),
  NULLIF(payload ->> 'notes', ''),
  COALESCE(NULLIF(payload ->> 'apiHealthP95Ms', '')::integer, 0),
  COALESCE(NULLIF(payload ->> 'apiDrepsP95Ms', '')::integer, 0),
  COALESCE(NULLIF(payload ->> 'apiV1DrepsP95Ms', '')::integer, 0),
  COALESCE(NULLIF(payload ->> 'governanceHealthP95Ms', '')::integer, 0),
  COALESCE(NULLIF(payload ->> 'errorRatePct', '')::numeric, 0),
  created_at
FROM admin_audit_log
WHERE action = 'systems_performance_baseline_logged'
  AND payload IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM systems_performance_baselines existing
    WHERE existing.created_at = admin_audit_log.created_at
      AND existing.scenario_label = admin_audit_log.payload ->> 'scenarioLabel'
  );

INSERT INTO systems_trust_surface_reviews (
  actor_type,
  wallet_address,
  review_date,
  overall_status,
  linked_slo_ids,
  reviewed_surfaces,
  summary,
  current_user_state,
  honesty_gap,
  next_fix,
  owner,
  artifact_url,
  notes,
  created_at
)
SELECT
  payload ->> 'actorType',
  wallet_address,
  (payload ->> 'reviewDate')::date,
  payload ->> 'overallStatus',
  COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(payload -> 'linkedSloIds')),
    '{}'
  ),
  COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(payload -> 'reviewedSurfaces')),
    '{}'
  ),
  payload ->> 'summary',
  payload ->> 'currentUserState',
  payload ->> 'honestyGap',
  payload ->> 'nextFix',
  payload ->> 'owner',
  NULLIF(payload ->> 'artifactUrl', ''),
  NULLIF(payload ->> 'notes', ''),
  created_at
FROM admin_audit_log
WHERE action = 'systems_trust_surface_review_logged'
  AND payload IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM systems_trust_surface_reviews existing
    WHERE existing.created_at = admin_audit_log.created_at
      AND existing.review_date = (admin_audit_log.payload ->> 'reviewDate')::date
  );

INSERT INTO systems_review_drafts (
  actor_type,
  wallet_address,
  review_date,
  overall_status,
  focus_area,
  top_risk,
  change_notes,
  hardening_commitment_title,
  hardening_commitment_summary,
  commitment_owner,
  commitment_due_date,
  linked_slo_ids,
  created_at
)
SELECT
  payload ->> 'actorType',
  wallet_address,
  (payload ->> 'reviewDate')::date,
  payload ->> 'overallStatus',
  payload ->> 'focusArea',
  payload ->> 'topRisk',
  payload ->> 'changeNotes',
  payload ->> 'hardeningCommitmentTitle',
  payload ->> 'hardeningCommitmentSummary',
  payload ->> 'commitmentOwner',
  NULLIF(payload ->> 'commitmentDueDate', '')::date,
  COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(payload -> 'linkedSloIds')),
    '{}'
  ),
  created_at
FROM admin_audit_log
WHERE action = 'systems_review_draft_generated'
  AND payload IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM systems_review_drafts existing
    WHERE existing.created_at = admin_audit_log.created_at
      AND existing.review_date = (admin_audit_log.payload ->> 'reviewDate')::date
  );

END IF;
END;
$systems_backfill$;

COMMIT;
