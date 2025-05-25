CREATE TABLE public.crop_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    _last_modified BIGINT DEFAULT (extract(epoch from now()) * 1000),
    _synced BOOLEAN DEFAULT false,
    CONSTRAINT check_season_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.crop_seasons IS 'Defines distinct growing seasons (e.g., "Spring 2026", "Autumn/Winter 2025").';
COMMENT ON COLUMN public.crop_seasons.name IS 'User-defined name for the crop season.';

-- RLS Policies
ALTER TABLE public.crop_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage crop_seasons" ON public.crop_seasons
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to crop_seasons" ON public.crop_seasons
    FOR SELECT
    USING (true);