ALTER TABLE public.planting_logs
ADD COLUMN crop_plan_id UUID REFERENCES public.crop_plans(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.planting_logs.crop_plan_id IS 'Optional link to the crop plan this planting log fulfills.';

-- Optional: Add an index if you frequently query planting_logs by crop_plan_id
CREATE INDEX IF NOT EXISTS idx_planting_logs_crop_plan_id ON public.planting_logs(crop_plan_id);