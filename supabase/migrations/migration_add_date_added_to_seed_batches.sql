-- Add date_added_to_inventory column to seed_batches table
ALTER TABLE public.seed_batches
ADD COLUMN date_added_to_inventory DATE;

-- Note: For existing records in Supabase that were created before this migration, 
-- this column will initially be NULL.
-- The Dexie upgrade function (version 26 in db.ts) attempts to set a default 
-- for local records using purchase_date or the date part of created_at.

-- If you wish to initialize existing NULL date_added_to_inventory fields in Supabase
-- with a similar logic (e.g., using purchase_date or the date part of created_at):
-- UPDATE public.seed_batches 
-- SET date_added_to_inventory = COALESCE(purchase_date, DATE(created_at)) 
-- WHERE date_added_to_inventory IS NULL;
-- Please ensure your 'purchase_date' column is of DATE type or can be cast/used directly.
-- 'created_at' is typically a timestamptz, so DATE(created_at) extracts the date part.