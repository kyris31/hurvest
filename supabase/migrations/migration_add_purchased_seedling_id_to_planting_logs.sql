ALTER TABLE public.planting_logs
ADD COLUMN purchased_seedling_id UUID REFERENCES public.purchased_seedlings(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.planting_logs.purchased_seedling_id IS 'Reference to the purchased_seedlings table if the planting was from a purchased batch.';