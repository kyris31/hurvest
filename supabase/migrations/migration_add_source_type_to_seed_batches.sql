-- Add source_type column to seed_batches table
ALTER TABLE public.seed_batches
ADD COLUMN source_type TEXT;

-- Optional: Add a check constraint if you want to limit values at the DB level
-- ALTER TABLE public.seed_batches
-- ADD CONSTRAINT check_seed_batch_source_type CHECK (source_type IN ('purchased', 'self_produced'));

-- Note: For existing records in Supabase that were created before this migration, 
-- this column will initially be NULL.
-- The Dexie upgrade function (version 26 in db.ts) attempts to set a default 
-- ('purchased' if supplier_id exists, otherwise 'self_produced') for local records.
-- When these local records sync to Supabase, the NULL will be updated.

-- If you wish to initialize all existing NULL source_type fields in Supabase immediately:
-- UPDATE public.seed_batches 
-- SET source_type = CASE 
--                     WHEN supplier_id IS NOT NULL THEN 'purchased' 
--                     ELSE 'self_produced' 
--                   END 
-- WHERE source_type IS NULL;