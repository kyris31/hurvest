-- Update supplier_invoice_items table for detailed packaging and item quantities

-- Step 1: Add new columns (make them nullable temporarily if old data exists)
ALTER TABLE public.supplier_invoice_items
ADD COLUMN IF NOT EXISTS package_quantity NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS package_unit_of_measure TEXT,
ADD COLUMN IF NOT EXISTS item_quantity_per_package NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS item_unit_of_measure TEXT,
ADD COLUMN IF NOT EXISTS price_per_package_gross NUMERIC(10, 2);

-- Step 2: Migrate data from old columns to new columns (if applicable)
-- This assumes old 'quantity' was 'package_quantity' and 'unit_price_gross' was 'price_per_package_gross'
-- and 'unit_of_measure' was 'package_unit_of_measure'.
-- Run this only if you have existing data that needs migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supplier_invoice_items' AND column_name='quantity') THEN
    UPDATE public.supplier_invoice_items
    SET 
      package_quantity = quantity,
      package_unit_of_measure = unit_of_measure,
      price_per_package_gross = unit_price_gross
    WHERE package_quantity IS NULL AND quantity IS NOT NULL; -- Only update if new field is empty and old has data
  END IF;
END $$;

-- Step 3: Make new columns NOT NULL if they are mandatory and data migration is complete
-- For example, package_quantity and price_per_package_gross are likely mandatory.
-- Ensure data is populated before making them NOT NULL.
-- This example assumes they will be populated by the app or migration.
ALTER TABLE public.supplier_invoice_items
ALTER COLUMN package_quantity SET NOT NULL,  -- If all existing rows are migrated or new ones will have it
ALTER COLUMN price_per_package_gross SET NOT NULL; -- If all existing rows are migrated or new ones will have it

-- Step 4: Drop old columns (after verifying data migration)
ALTER TABLE public.supplier_invoice_items
DROP COLUMN IF EXISTS quantity,
DROP COLUMN IF EXISTS unit_of_measure,
DROP COLUMN IF EXISTS unit_price_gross;

COMMENT ON COLUMN public.supplier_invoice_items.package_quantity IS 'Number of packages/containers purchased (e.g., 2 bottles, 5 bags).';
COMMENT ON COLUMN public.supplier_invoice_items.package_unit_of_measure IS 'Unit for package_quantity (e.g., "bottle", "bag", "case").';
COMMENT ON COLUMN public.supplier_invoice_items.item_quantity_per_package IS 'Quantity of the item within one package (e.g., 20 if L per bottle, 25 if kg per bag).';
COMMENT ON COLUMN public.supplier_invoice_items.item_unit_of_measure IS 'Unit for item_quantity_per_package (e.g., "L", "kg", "ml").';
COMMENT ON COLUMN public.supplier_invoice_items.price_per_package_gross IS 'Price for one package/container (gross, before overall invoice discounts/VAT).';

-- Re-check RLS policies if needed, though column changes usually don't affect them directly.
-- Ensure indexes are still optimal. The existing ones on supplier_invoice_id and input_inventory_id should be fine.