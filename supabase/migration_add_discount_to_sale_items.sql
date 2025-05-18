-- Add discount fields to sale_items table
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('Amount', 'Percentage')),
ADD COLUMN IF NOT EXISTS discount_value NUMERIC;

COMMENT ON COLUMN sale_items.discount_type IS 'Type of discount applied to the sale item: "Amount" or "Percentage". Can be NULL if no discount.';
COMMENT ON COLUMN sale_items.discount_value IS 'The value of the discount (either a fixed amount or a percentage value). Can be NULL if no discount.';

-- Add a check constraint to ensure discount_value is positive if discount_type is set
-- This is optional but good for data integrity.
-- Consider if 0 is a valid discount_value (e.g. to explicitly state no discount vs NULL)
ALTER TABLE sale_items
ADD CONSTRAINT chk_discount_value CHECK (
    (discount_type IS NULL AND discount_value IS NULL) OR
    (discount_type IS NOT NULL AND discount_value IS NOT NULL AND discount_value >= 0)
);


SELECT 'Migration to add discount fields to sale_items applied.' AS status;