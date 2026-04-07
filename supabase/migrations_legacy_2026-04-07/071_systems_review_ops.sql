-- Systems operating loop persistence
-- Weekly reviews plus named hardening commitments for the /admin/systems cockpit

BEGIN;

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

DROP TRIGGER IF EXISTS set_systems_commitments_updated_at ON systems_commitments;
CREATE TRIGGER set_systems_commitments_updated_at
  BEFORE UPDATE ON systems_commitments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE systems_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "systems_reviews_service_role_full_access"
  ON systems_reviews FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "systems_commitments_service_role_full_access"
  ON systems_commitments FOR ALL
  USING (auth.role() = 'service_role');

COMMIT;
