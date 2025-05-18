-- Remove variety column from seed_batches table
-- Ensure this is desired, as variety information is now on the crops table.
ALTER TABLE seed_batches
DROP COLUMN IF EXISTS variety;

COMMENT ON TABLE seed_batches IS 'Seed batches for planting. Variety information is now referenced via the crop_id linking to the crops table.';

SELECT 'Migration to remove variety from seed_batches table applied.' AS status;