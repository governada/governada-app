-- Denormalized voting power on each vote record for fast proposal-level aggregation
ALTER TABLE drep_votes ADD COLUMN IF NOT EXISTS voting_power_lovelace BIGINT;
