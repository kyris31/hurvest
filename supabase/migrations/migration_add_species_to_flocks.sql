-- Add species column to flocks table
ALTER TABLE public.flocks
ADD COLUMN species TEXT;

-- Optional: Add a check constraint if you want to limit species values at the DB level
-- ALTER TABLE public.flocks
-- ADD CONSTRAINT check_flock_species CHECK (species IN ('chicken', 'turkey', 'duck', 'quail', 'other'));

-- Re-grant permissions if necessary.
-- If you are using RLS, ensure your policies account for the new column if needed,
-- though typically policies are row-based and adding a column doesn't immediately break them
-- unless the policy logic specifically referenced a non-existent state due to the column.
-- For basic RLS allowing authed users CRUD, existing policies should generally be fine.
-- If you had very open policies for anon for some reason, review them.

-- Example of re-asserting common RLS policies if they were somehow dropped or need refresh:
-- (Uncomment and adapt if you suspect RLS issues after schema changes)
-- ALTER TABLE public.flocks ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Enable read access for all users" ON public.flocks;
-- CREATE POLICY "Enable read access for all users" ON public.flocks FOR SELECT USING (true);
-- DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.flocks;
-- CREATE POLICY "Enable insert for authenticated users only" ON public.flocks FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
-- DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.flocks;
-- CREATE POLICY "Enable update for authenticated users only" ON public.flocks FOR UPDATE TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.flocks;
-- CREATE POLICY "Enable delete for authenticated users only" ON public.flocks FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

-- After applying this migration (e.g., via Supabase Studio or `supabase db push`),
-- it's good practice to refresh Supabase's schema cache.
-- This can sometimes be done by navigating to API settings in Supabase Studio or by a project restart.
-- The error "Could not find the 'column' of 'table' in the schema cache" usually resolves after this.