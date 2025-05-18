-- Rename cost_per_unit to total_purchase_cost in input_inventory table
ALTER TABLE input_inventory
RENAME COLUMN cost_per_unit TO total_purchase_cost;

COMMENT ON COLUMN input_inventory.total_purchase_cost IS 'The total cost paid for the initial quantity of this inventory item.';

-- Note: If you had existing data in cost_per_unit that was truly per-unit,
-- you might need a more complex migration to calculate the new total_purchase_cost
-- for existing rows (e.g., total_purchase_cost = old_cost_per_unit * initial_quantity).
-- This script assumes cost_per_unit was already being used to store the total cost,
-- or that new entries will correctly use total_purchase_cost.
-- If migration of existing data values is needed, add that logic here.
-- For example, to update existing rows if cost_per_unit was indeed per unit:
-- UPDATE input_inventory
-- SET total_purchase_cost = total_purchase_cost * initial_quantity
-- WHERE initial_quantity IS NOT NULL AND total_purchase_cost IS NOT NULL; 
-- (Run this type of UPDATE only if you are sure about the original meaning of the data)

SELECT 'Migration to rename cost_per_unit to total_purchase_cost in input_inventory applied.' AS status;