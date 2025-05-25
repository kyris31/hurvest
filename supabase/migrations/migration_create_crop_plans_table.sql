CREATE TABLE public.crop_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name TEXT NOT NULL,
    crop_id UUID NOT NULL REFERENCES public.crops(id),
    plot_id UUID REFERENCES public.plots(id), -- Nullable if plan not tied to specific plot yet
    crop_season_id UUID NOT NULL REFERENCES public.crop_seasons(id),
    planting_type TEXT NOT NULL CHECK (planting_type IN ('DIRECT_SEED', 'TRANSPLANT_NURSERY', 'TRANSPLANT_PURCHASED')),
    planned_sowing_date DATE, -- For nursery or direct seed
    planned_transplant_date DATE,
    planned_first_harvest_date DATE,
    planned_last_harvest_date DATE,
    estimated_days_to_maturity INTEGER,
    target_quantity_plants INTEGER,
    target_quantity_area_sqm NUMERIC,
    target_yield_estimate_kg NUMERIC,
    target_yield_unit TEXT,
    status TEXT DEFAULT 'DRAFT' NOT NULL CHECK (status IN ('DRAFT', 'PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    _last_modified BIGINT DEFAULT (extract(epoch from now()) * 1000),
    _synced BOOLEAN DEFAULT false
);

COMMENT ON TABLE public.crop_plans IS 'Core table for planning specific crop plantings, linking crops, plots, and seasons.';
COMMENT ON COLUMN public.crop_plans.planting_type IS 'Indicates the method of planting: Direct Seed, Transplant from own nursery, or Transplant from purchased seedlings.';
COMMENT ON COLUMN public.crop_plans.status IS 'Current status of the crop plan.';

-- Indexes
CREATE INDEX idx_crop_plans_crop_id ON public.crop_plans(crop_id);
CREATE INDEX idx_crop_plans_plot_id ON public.crop_plans(plot_id);
CREATE INDEX idx_crop_plans_crop_season_id ON public.crop_plans(crop_season_id);
CREATE INDEX idx_crop_plans_status ON public.crop_plans(status);
CREATE INDEX idx_crop_plans_planned_sowing_date ON public.crop_plans(planned_sowing_date);
CREATE INDEX idx_crop_plans_planned_transplant_date ON public.crop_plans(planned_transplant_date);

-- RLS Policies
ALTER TABLE public.crop_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage crop_plans" ON public.crop_plans
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to crop_plans" ON public.crop_plans
    FOR SELECT
    USING (true);