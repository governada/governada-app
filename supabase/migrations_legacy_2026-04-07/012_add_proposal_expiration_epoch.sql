-- Add expiration_epoch to proposals table
-- This is the hard deadline epoch from Koios (proposed_epoch + govActionLifetime).
-- Storing it directly avoids estimating from govActionLifetime, which is a
-- protocol parameter that could change via a ParameterChange governance action.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS expiration_epoch INTEGER;
