CREATE TABLE public.crop_plan_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_plan_id UUID NOT NULL REFERENCES public.crop_plans(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    stage_type TEXT NOT NULL CHECK (stage_type IN ('NURSERY_SOWING', 'NURSERY_POTTING_ON', 'DIRECT_SEEDING', 'SOIL_PREPARATION', 'TRANSPLANTING', 'FIELD_MAINTENANCE', 'PEST_DISEASE_CONTROL', 'HARVEST_WINDOW')),
    planned_start_date DATE NOT NULL,
    planned_duration_days INTEGER NOT NULL,
    actual_start_date DATE,
    actual_end_date DATE,
    status TEXT DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    notes TEXT,

    -- Nursery Stage Fields
    nursery_total_days INTEGER,
    nursery_seeding_tray_type TEXT,
    nursery_seeds_per_cell INTEGER,
    nursery_soil_mix_details TEXT,
    nursery_seeding_technique TEXT,
    nursery_days_before_repotting INTEGER,
    nursery_repotting_container_type TEXT,

    -- Direct Seed Stage Fields
    direct_seed_rows_per_bed INTEGER,
    direct_seed_seeder_type TEXT,
    direct_seed_spacing_in_row_cm NUMERIC,
    direct_seed_spacing_between_rows_cm NUMERIC,
    direct_seed_depth_cm NUMERIC,
    direct_seed_calibration TEXT,

    -- Transplant Stage Fields
    transplant_rows_per_bed INTEGER,
    transplant_spacing_in_row_cm NUMERIC,
    transplant_spacing_between_rows_cm NUMERIC,
    transplant_source_container_type TEXT,
    transplant_row_marking_method TEXT,
    transplant_irrigation_details TEXT,

    -- Generic Task Details
    generic_field_task_details TEXT,
    
    additional_details_json JSONB, -- For any other non-standard details

    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    _last_modified BIGINT DEFAULT (extract(epoch from now()) * 1000),
    _synced BOOLEAN DEFAULT false
);

COMMENT ON TABLE public.crop_plan_stages IS 'Defines specific stages or phases within a crop plan (e.g., nursery, transplanting).';
COMMENT ON COLUMN public.crop_plan_stages.stage_type IS 'The type of stage (e.g., Nursery Sowing, Direct Seeding, Transplanting).';
COMMENT ON COLUMN public.crop_plan_stages.additional_details_json IS 'Flexible JSON field for any stage-specific details not covered by dedicated columns.';

-- Indexes
CREATE INDEX idx_crop_plan_stages_crop_plan_id ON public.crop_plan_stages(crop_plan_id);
CREATE INDEX idx_crop_plan_stages_stage_type ON public.crop_plan_stages(stage_type);
CREATE INDEX idx_crop_plan_stages_planned_start_date ON public.crop_plan_stages(planned_start_date);

-- RLS Policies
ALTER TABLE public.crop_plan_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage crop_plan_stages" ON public.crop_plan_stages
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to crop_plan_stages" ON public.crop_plan_stages
    FOR SELECT
    USING (true);