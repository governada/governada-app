-- PCA Alignment System: tables for AI classification, PCA engine, and temporal trajectories

-- 1. Proposal classifications (AI-powered semantic classification per dimension)
CREATE TABLE IF NOT EXISTS proposal_classifications (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index   INTEGER NOT NULL,
  dim_treasury_conservative REAL DEFAULT 0,
  dim_treasury_growth       REAL DEFAULT 0,
  dim_decentralization      REAL DEFAULT 0,
  dim_security              REAL DEFAULT 0,
  dim_innovation            REAL DEFAULT 0,
  dim_transparency          REAL DEFAULT 0,
  ai_summary    TEXT,
  classified_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (proposal_tx_hash, proposal_index)
);

-- 2. PCA run results (global loadings + metadata per computation)
CREATE TABLE IF NOT EXISTS pca_results (
  run_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at             TIMESTAMPTZ DEFAULT now(),
  num_dreps               INTEGER NOT NULL,
  num_proposals           INTEGER NOT NULL,
  components              INTEGER NOT NULL,
  explained_variance      REAL[] NOT NULL,
  total_explained_variance REAL NOT NULL,
  loadings                JSONB NOT NULL,
  proposal_ids            TEXT[] NOT NULL,
  is_active               BOOLEAN DEFAULT true
);

-- Only one active PCA run at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pca_results_active
  ON pca_results (is_active) WHERE is_active = true;

-- 3. Per-DRep PCA coordinates
CREATE TABLE IF NOT EXISTS drep_pca_coordinates (
  drep_id     TEXT NOT NULL,
  run_id      UUID NOT NULL REFERENCES pca_results(run_id) ON DELETE CASCADE,
  coordinates REAL[] NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (drep_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_drep_pca_active
  ON drep_pca_coordinates (run_id);

-- 4. Alignment snapshots for temporal trajectories
CREATE TABLE IF NOT EXISTS alignment_snapshots (
  drep_id                        TEXT NOT NULL,
  epoch                          INTEGER NOT NULL,
  alignment_treasury_conservative INTEGER,
  alignment_treasury_growth       INTEGER,
  alignment_decentralization      INTEGER,
  alignment_security              INTEGER,
  alignment_innovation            INTEGER,
  alignment_transparency          INTEGER,
  pca_coordinates                 REAL[],
  snapshot_at                     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (drep_id, epoch)
);

CREATE INDEX IF NOT EXISTS idx_alignment_snapshots_drep
  ON alignment_snapshots (drep_id, epoch DESC);

-- 5. Add raw score columns to dreps table (percentile goes in existing columns)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'alignment_treasury_conservative_raw') THEN
    ALTER TABLE dreps ADD COLUMN alignment_treasury_conservative_raw REAL;
    ALTER TABLE dreps ADD COLUMN alignment_treasury_growth_raw REAL;
    ALTER TABLE dreps ADD COLUMN alignment_decentralization_raw REAL;
    ALTER TABLE dreps ADD COLUMN alignment_security_raw REAL;
    ALTER TABLE dreps ADD COLUMN alignment_innovation_raw REAL;
    ALTER TABLE dreps ADD COLUMN alignment_transparency_raw REAL;
  END IF;
END $$;

-- 6. Add rationale_quality column to drep_votes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drep_votes' AND column_name = 'rationale_quality') THEN
    ALTER TABLE drep_votes ADD COLUMN rationale_quality REAL;
  END IF;
END $$;

-- RLS: read-only public access for classification and PCA data
ALTER TABLE proposal_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pca_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE drep_pca_coordinates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alignment_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proposal_classifications_read') THEN
    CREATE POLICY proposal_classifications_read ON proposal_classifications FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pca_results_read') THEN
    CREATE POLICY pca_results_read ON pca_results FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drep_pca_coordinates_read') THEN
    CREATE POLICY drep_pca_coordinates_read ON drep_pca_coordinates FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'alignment_snapshots_read') THEN
    CREATE POLICY alignment_snapshots_read ON alignment_snapshots FOR SELECT USING (true);
  END IF;
END $$;
