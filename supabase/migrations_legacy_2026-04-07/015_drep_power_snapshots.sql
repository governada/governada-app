-- Historical voting power snapshots per DRep per epoch
-- Enables accurate threshold calculations using power-at-vote-time

CREATE TABLE IF NOT EXISTS drep_power_snapshots (
  drep_id TEXT NOT NULL,
  epoch_no INTEGER NOT NULL,
  amount_lovelace BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (drep_id, epoch_no)
);

CREATE INDEX IF NOT EXISTS idx_power_snapshots_epoch ON drep_power_snapshots(epoch_no);
