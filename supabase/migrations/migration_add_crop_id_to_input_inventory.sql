-- Add crop_id column to input_inventory table
ALTER TABLE public.input_inventory
ADD COLUMN crop_id UUID REFERENCES public.crops(id) ON DELETE SET NULL;

-- This allows linking an inventory item (like purchased seedlings) to a specific crop.
-- ON DELETE SET NULL means if the referenced crop is deleted, this crop_id will become NULL.

-- Optional: Add an index if you anticipate querying input_inventory frequently by crop_id
-- CREATE INDEX idx_input_inventory_crop_id ON public.input_inventory(crop_id);