-- SPO governance layer: score + alignment snapshots per epoch

CREATE TABLE IF NOT EXISTS spo_score_snapshots (
  pool_id text NOT NULL,
  epoch_no integer NOT NULL,
  governance_score integer,
  participation_rate numeric(5,2),
  rationale_rate numeric(5,2),
  vote_count integer DEFAULT 0,
  snapshot_at timestamptz DEFAULT now(),
  PRIMARY KEY (pool_id, epoch_no)
);

CREATE TABLE IF NOT EXISTS spo_alignment_snapshots (
  pool_id text NOT NULL,
  epoch_no integer NOT NULL,
  alignment_treasury_conservative numeric(5,2),
  alignment_treasury_growth numeric(5,2),
  alignment_decentralization numeric(5,2),
  alignment_security numeric(5,2),
  alignment_innovation numeric(5,2),
  alignment_transparency numeric(5,2),
  snapshot_at timestamptz DEFAULT now(),
  PRIMARY KEY (pool_id, epoch_no)
);

CREATE INDEX IF NOT EXISTS idx_spo_score_snapshots_epoch ON spo_score_snapshots(epoch_no);
CREATE INDEX IF NOT EXISTS idx_spo_alignment_snapshots_epoch ON spo_alignment_snapshots(epoch_no);
