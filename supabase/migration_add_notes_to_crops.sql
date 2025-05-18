-- Add notes column to crops table
ALTER TABLE crops
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN crops.notes IS 'General notes or description for the crop.';

-- Note: No default value is set for existing rows; 'notes' will be NULL for them.

SELECT 'Migration to add notes to crops table applied.' AS status;