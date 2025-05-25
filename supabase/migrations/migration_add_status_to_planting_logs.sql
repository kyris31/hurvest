ALTER TABLE public.planting_logs
   ADD COLUMN status TEXT DEFAULT 'active' NOT NULL,
   ADD COLUMN actual_end_date DATE;

   COMMENT ON COLUMN public.planting_logs.status IS 'The current status of the planting log (e.g., active, completed, terminated).';
   COMMENT ON COLUMN public.planting_logs.actual_end_date IS 'The date when the plantation was officially considered finished or terminated.';

   -- Add a check constraint for allowed status values
   ALTER TABLE public.planting_logs
   ADD CONSTRAINT check_planting_log_status CHECK (status IN ('active', 'completed', 'terminated'));