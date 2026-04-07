-- WP-12: Proposal Outcome Tracking
-- Tracks delivery status for enacted proposals, connecting governance decisions to real-world impact.

CREATE TABLE proposal_outcomes (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index   INTEGER NOT NULL,

  -- Delivery status
  delivery_status  TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (delivery_status IN ('in_progress', 'delivered', 'partial', 'not_delivered', 'unknown')),

  -- Computed delivery score 0-100 (aggregated from accountability poll results)
  delivery_score   SMALLINT CHECK (delivery_score IS NULL OR (delivery_score >= 0 AND delivery_score <= 100)),

  -- Accountability poll aggregation
  total_poll_responses   INTEGER NOT NULL DEFAULT 0,
  delivered_count        INTEGER NOT NULL DEFAULT 0,
  partial_count          INTEGER NOT NULL DEFAULT 0,
  not_delivered_count    INTEGER NOT NULL DEFAULT 0,
  too_early_count        INTEGER NOT NULL DEFAULT 0,
  would_approve_again_pct NUMERIC(5,2),

  -- Milestone tracking (for treasury proposals with known deliverables)
  milestones_total       SMALLINT,
  milestones_completed   SMALLINT,

  -- Epoch tracking
  enacted_epoch          INTEGER,
  last_evaluated_epoch   INTEGER,
  epochs_since_enactment INTEGER GENERATED ALWAYS AS (
    CASE WHEN enacted_epoch IS NOT NULL AND last_evaluated_epoch IS NOT NULL
      THEN last_evaluated_epoch - enacted_epoch
      ELSE NULL
    END
  ) STORED,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (proposal_tx_hash, proposal_index),
  CONSTRAINT fk_proposal FOREIGN KEY (proposal_tx_hash, proposal_index)
    REFERENCES proposals (tx_hash, proposal_index) ON DELETE CASCADE
);

CREATE INDEX idx_proposal_outcomes_status ON proposal_outcomes (delivery_status);
CREATE INDEX idx_proposal_outcomes_score ON proposal_outcomes (delivery_score DESC NULLS LAST);

ALTER TABLE proposal_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read proposal outcomes"
  ON proposal_outcomes FOR SELECT USING (true);

CREATE POLICY "Service role can manage proposal outcomes"
  ON proposal_outcomes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Feature flag
INSERT INTO feature_flags (key, enabled, description, category)
VALUES ('proposal_outcome_tracking', true, 'WP-12: Show delivery status and outcome tracking on proposal pages and DRep voting records', 'governance')
ON CONFLICT (key) DO NOTHING;
