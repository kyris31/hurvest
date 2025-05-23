-- Add payment_history column to sales table
ALTER TABLE public.sales
ADD COLUMN payment_history JSONB;

-- Note: For existing records in Supabase that were created before this migration, 
-- this column will initially be NULL.
-- The Dexie upgrade function (version 25 in db.ts) initializes payment_history as an empty array []
-- for local records. When these local records (new or old ones that get modified) sync to Supabase, 
-- the NULL value in Supabase for those records will be updated to an empty array or actual history.

-- If you wish to initialize all existing NULL payment_history fields in Supabase to an empty array immediately,
-- you can run the following UPDATE statement after the ALTER TABLE command has been applied:
-- UPDATE public.sales SET payment_history = '[]'::jsonb WHERE payment_history IS NULL;