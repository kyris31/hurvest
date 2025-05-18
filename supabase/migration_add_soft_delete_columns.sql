-- Add is_deleted and deleted_at columns to all relevant tables

ALTER TABLE crops
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE seed_batches
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE input_inventory
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE planting_logs
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE cultivation_logs
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE harvest_logs
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Optional: Create indexes on is_deleted for tables where you frequently filter by it
-- CREATE INDEX IF NOT EXISTS idx_crops_is_deleted ON crops (is_deleted);
-- CREATE INDEX IF NOT EXISTS idx_seed_batches_is_deleted ON seed_batches (is_deleted);
-- ... and so on for other tables if needed for performance on large datasets.

-- Reminder: Ensure your RLS policies are updated as per the previous schema.sql changes
-- to allow 'anon' role to manage data if you are not using user authentication.
-- Example for one table (repeat for all):
-- DROP POLICY IF EXISTS "Allow anon users to manage crops" ON crops;
-- CREATE POLICY "Allow anon users to manage crops" ON crops FOR ALL TO anon USING (true) WITH CHECK (true);
-- (The previous schema.sql already contains these, this is just a reminder if applying parts)

COMMENT ON COLUMN crops.is_deleted IS 'Flag for soft deletion';
COMMENT ON COLUMN crops.deleted_at IS 'Timestamp of soft deletion';
-- Add comments for other tables as well if desired.