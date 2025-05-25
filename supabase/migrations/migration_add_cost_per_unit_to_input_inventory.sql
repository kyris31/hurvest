ALTER TABLE public.input_inventory
ADD COLUMN cost_per_unit NUMERIC;

-- Optional: Backfill existing rows if possible
-- This assumes total_purchase_cost and initial_quantity are reliable
UPDATE public.input_inventory
SET cost_per_unit = CASE
    WHEN initial_quantity IS NOT NULL AND initial_quantity > 0 AND total_purchase_cost IS NOT NULL
    THEN total_purchase_cost / initial_quantity
    ELSE 0
END
WHERE cost_per_unit IS NULL;