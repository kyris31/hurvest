-- Add input_inventory_id column to planting_logs table
ALTER TABLE public.planting_logs
ADD COLUMN input_inventory_id UUID REFERENCES public.input_inventory(id) ON DELETE SET NULL;

-- This allows linking a planting log to a specific item from input_inventory,
-- useful for tracking purchased seedlings that were planted.
-- ON DELETE SET NULL means if the referenced input inventory item is deleted, 
-- this input_inventory_id will become NULL in the planting_logs table.

-- Optional: Add an index if you anticipate querying planting_logs frequently by input_inventory_id
-- CREATE INDEX idx_planting_logs_input_inventory_id ON public.planting_logs(input_inventory_id);