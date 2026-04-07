-- Backfill epoch_no for drep_score_history entries that have null epoch_no.
-- Uses Cardano mainnet epoch math: epoch = floor((unix_time - shelley_genesis) / epoch_length) + shelley_base_epoch
-- Shelley genesis: 1596491091, epoch length: 432000s (5 days), base epoch: 209

UPDATE drep_score_history
SET epoch_no = FLOOR(
  (EXTRACT(EPOCH FROM snapshot_date::timestamp AT TIME ZONE 'UTC') - 1596491091) / 432000
)::int + 209
WHERE epoch_no IS NULL
  AND snapshot_date IS NOT NULL;
