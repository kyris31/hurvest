-- Add current_quantity column to seed_batches table
ALTER TABLE seed_batches
ADD COLUMN IF NOT EXISTS current_quantity NUMERIC;

-- Initialize current_quantity with initial_quantity for existing rows
-- where current_quantity is NULL.
UPDATE seed_batches
SET current_quantity = initial_quantity
WHERE current_quantity IS NULL;

COMMENT ON COLUMN seed_batches.current_quantity IS 'The current available quantity of the seed batch, updated after plantings.';

SELECT 'Migration to add and initialize current_quantity for seed_batches applied.' AS status;