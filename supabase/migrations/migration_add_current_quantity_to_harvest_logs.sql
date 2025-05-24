-- Add current_quantity_available to harvest_logs table
ALTER TABLE public.harvest_logs
ADD COLUMN IF NOT EXISTS current_quantity_available NUMERIC;

-- Populate current_quantity_available with quantity_harvested for existing rows
-- This ensures that previously harvested items have their availability set correctly.
-- Run this only once after adding the column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'harvest_logs' 
    AND column_name = 'current_quantity_available'
  ) THEN
    UPDATE public.harvest_logs
    SET current_quantity_available = quantity_harvested
    WHERE current_quantity_available IS NULL;
  END IF;
END $$;

-- Optional: Add a constraint to ensure current_quantity_available is not negative,
-- though application logic should primarily handle this.
-- ALTER TABLE public.harvest_logs
-- ADD CONSTRAINT current_quantity_available_non_negative
-- CHECK (current_quantity_available >= 0);

COMMENT ON COLUMN public.harvest_logs.current_quantity_available IS 'The current quantity available from this specific harvest batch, reduced as items are sold.';