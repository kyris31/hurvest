CREATE TABLE public.plots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    length_m NUMERIC,
    width_m NUMERIC,
    area_sqm NUMERIC, -- Can be calculated or entered
    status TEXT DEFAULT 'active', -- e.g., 'active', 'fallow', 'in_use', 'needs_prep'
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    _last_modified BIGINT DEFAULT (extract(epoch from now()) * 1000),
    _synced BOOLEAN DEFAULT false
);

COMMENT ON TABLE public.plots IS 'Defines distinct planting areas, beds, or locations within the farm.';
COMMENT ON COLUMN public.plots.name IS 'User-defined name for the plot (e.g., "Greenhouse 1 - Bed A", "Field West - Section 2").';
COMMENT ON COLUMN public.plots.status IS 'Current status of the plot.';

-- RLS Policies
ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage plots" ON public.plots
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to plots" ON public.plots
    FOR SELECT
    USING (true);