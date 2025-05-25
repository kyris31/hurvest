CREATE TABLE public.planned_stage_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_plan_stage_id UUID NOT NULL REFERENCES public.crop_plan_stages(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('LABOR', 'INPUT_ITEM', 'EQUIPMENT', 'OTHER')),
    description TEXT NOT NULL,
    input_inventory_id UUID REFERENCES public.input_inventory(id) ON DELETE SET NULL, -- Nullable, for 'INPUT_ITEM'
    planned_quantity NUMERIC,
    quantity_unit TEXT,
    estimated_cost NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    _last_modified BIGINT DEFAULT (extract(epoch from now()) * 1000),
    _synced BOOLEAN DEFAULT false
);

COMMENT ON TABLE public.planned_stage_resources IS 'Stores planned resources (labor, materials, equipment) for each crop plan stage.';
COMMENT ON COLUMN public.planned_stage_resources.resource_type IS 'Type of resource: LABOR, INPUT_ITEM, EQUIPMENT, OTHER.';
COMMENT ON COLUMN public.planned_stage_resources.input_inventory_id IS 'Link to input_inventory if resource_type is INPUT_ITEM.';

-- Indexes
CREATE INDEX idx_planned_stage_resources_crop_plan_stage_id ON public.planned_stage_resources(crop_plan_stage_id);
CREATE INDEX idx_planned_stage_resources_resource_type ON public.planned_stage_resources(resource_type);
CREATE INDEX idx_planned_stage_resources_input_inventory_id ON public.planned_stage_resources(input_inventory_id);

-- RLS Policies
ALTER TABLE public.planned_stage_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage planned_stage_resources" ON public.planned_stage_resources
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to planned_stage_resources" ON public.planned_stage_resources
    FOR SELECT
    USING (true);