CREATE TABLE public.purchased_seedlings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    crop_id UUID REFERENCES public.crops(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    purchase_date DATE,
    initial_quantity INTEGER NOT NULL DEFAULT 0,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    quantity_unit TEXT,
    cost_per_unit NUMERIC,
    total_purchase_cost NUMERIC,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    _synced INTEGER DEFAULT 0,
    _last_modified BIGINT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.purchased_seedlings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all access to own purchased seedlings"
ON public.purchased_seedlings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at_purchased_seedlings
BEFORE UPDATE ON public.purchased_seedlings
FOR EACH ROW
EXECUTE FUNCTION moddatetime (updated_at);

-- _last_modified will be set by the application, similar to other tables.
-- Removing trigger for _last_modified.

COMMENT ON TABLE public.purchased_seedlings IS 'Stores records of seedlings purchased from external suppliers.';
COMMENT ON COLUMN public.purchased_seedlings.name IS 'User-defined name for this batch of purchased seedlings, e.g., Strawberry Festival Plugs.';
COMMENT ON COLUMN public.purchased_seedlings.crop_id IS 'Optional link to the crops table if these seedlings correspond to a specific crop/variety.';
COMMENT ON COLUMN public.purchased_seedlings.initial_quantity IS 'Quantity of seedlings initially purchased.';
COMMENT ON COLUMN public.purchased_seedlings.current_quantity IS 'Current available quantity of these purchased seedlings.';
COMMENT ON COLUMN public.purchased_seedlings.cost_per_unit IS 'Calculated or entered cost for each seedling unit.';