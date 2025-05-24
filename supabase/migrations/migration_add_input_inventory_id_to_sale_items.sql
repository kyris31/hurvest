-- Add input_inventory_id to sale_items table to link sold items to specific inventory batches

ALTER TABLE public.sale_items
ADD COLUMN IF NOT EXISTS input_inventory_id UUID,
ADD CONSTRAINT fk_input_inventory
  FOREIGN KEY(input_inventory_id) 
  REFERENCES public.input_inventory(id)
  ON DELETE SET NULL; -- Or ON DELETE RESTRICT if a sale item should not exist without a valid inventory link

COMMENT ON COLUMN public.sale_items.input_inventory_id IS 'FK to input_inventory. Links a sold item to a specific batch of purchased goods.';

-- Note: If you have existing sale_items that should have been linked to input_inventory,
-- you would need a data migration step here. For new setups, this is often not needed.

-- Consider if an index on input_inventory_id is needed for performance,
-- e.g., if you frequently query sale_items by input_inventory_id.
-- CREATE INDEX IF NOT EXISTS idx_sale_items_input_inventory_id ON public.sale_items(input_inventory_id);