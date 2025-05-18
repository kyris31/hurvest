-- Add variety column to crops table
ALTER TABLE crops
ADD COLUMN IF NOT EXISTS variety TEXT;

COMMENT ON COLUMN crops.variety IS 'The specific variety of the crop, e.g., Cherry for Tomato, Nantes for Carrot.';

-- Note: No default value is set for existing rows; 'variety' will be NULL for them.
-- This can be handled in the application logic or by a separate data update script if defaults are needed.

SELECT 'Migration to add variety to crops table applied.' AS status;