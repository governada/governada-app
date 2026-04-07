-- Per-epoch governance aggregate stats (historicized from governance_stats)

CREATE TABLE IF NOT EXISTS governance_epoch_stats (
  epoch_no integer PRIMARY KEY,
  total_dreps integer,
  active_dreps integer,
  total_delegated_ada_lovelace text,
  total_proposals integer,
  proposals_submitted integer DEFAULT 0,
  proposals_ratified integer DEFAULT 0,
  proposals_expired integer DEFAULT 0,
  proposals_dropped integer DEFAULT 0,
  participation_rate numeric(5,2),
  rationale_rate numeric(5,2),
  avg_drep_score numeric(5,2),
  computed_at timestamptz DEFAULT now()
);
