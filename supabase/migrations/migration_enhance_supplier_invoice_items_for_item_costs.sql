-- Enhance supplier_invoice_items table for more detailed item-specific costing

-- Add columns for item-specific discounts
ALTER TABLE public.supplier_invoice_items
ADD COLUMN item_discount_type TEXT,
ADD COLUMN item_discount_value NUMERIC(10, 2);

COMMENT ON COLUMN public.supplier_invoice_items.item_discount_type IS 'Type of discount applied at the item level (e.g., Percentage, Amount)';
COMMENT ON COLUMN public.supplier_invoice_items.item_discount_value IS 'Value of the item-level discount';

-- Rename existing VAT columns for clarity to indicate they are item-specific
ALTER TABLE public.supplier_invoice_items
RENAME COLUMN vat_percentage TO item_vat_percentage;
ALTER TABLE public.supplier_invoice_items
RENAME COLUMN vat_amount_on_line TO item_vat_amount;

COMMENT ON COLUMN public.supplier_invoice_items.item_vat_percentage IS 'VAT percentage applied specifically to this item';
COMMENT ON COLUMN public.supplier_invoice_items.item_vat_amount IS 'VAT amount calculated specifically for this item (based on item_vat_percentage and price after item discount)';

-- Add column for cost after all item-specific adjustments (discounts and VAT)
ALTER TABLE public.supplier_invoice_items
ADD COLUMN cost_after_item_adjustments NUMERIC(12, 2);

COMMENT ON COLUMN public.supplier_invoice_items.cost_after_item_adjustments IS 'Cost of the item after its own specific discount and VAT have been applied, but before any invoice-level apportionments.';

-- Note: 
-- 'apportioned_discount_amount', 'apportioned_shipping_cost', 'apportioned_other_charges' remain for invoice-level apportionments.
-- 'line_subtotal_after_apportionment' will be (cost_after_item_adjustments - apportioned_invoice_discount + apportioned_invoice_shipping + apportioned_invoice_other_charges).
-- The invoice-level VAT will then be apportioned based on this 'line_subtotal_after_apportionment'.
-- 'line_total_net' remains the final net cost for the item, used for inventory valuation.