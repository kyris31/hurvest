-- Create supplier_invoice_items table
CREATE TABLE public.supplier_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
    input_inventory_id UUID REFERENCES public.input_inventory(id) ON DELETE SET NULL, 
    description_from_invoice TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_of_measure TEXT,
    unit_price_gross NUMERIC(10, 2) NOT NULL,
    line_total_gross NUMERIC(12, 2), 
    
    apportioned_discount_amount NUMERIC(10, 2) DEFAULT 0,
    apportioned_shipping_cost NUMERIC(10, 2) DEFAULT 0,
    apportioned_other_charges NUMERIC(10, 2) DEFAULT 0,
    
    line_subtotal_after_apportionment NUMERIC(12, 2), 
    
    vat_percentage NUMERIC(5, 2),
    vat_amount_on_line NUMERIC(10, 2),
    
    line_total_net NUMERIC(12, 2) NOT NULL,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX idx_sii_supplier_invoice_id ON public.supplier_invoice_items(supplier_invoice_id);
CREATE INDEX idx_sii_input_inventory_id ON public.supplier_invoice_items(input_inventory_id);

-- RLS policies
ALTER TABLE public.supplier_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to authenticated users for supplier invoice items"
ON public.supplier_invoice_items
FOR ALL
TO authenticated
USING (true) 
WITH CHECK (true);

-- Optional: Enable read access for anon users if needed, though typically protected.
-- CREATE POLICY "Enable read access for anon users for supplier invoice items"
-- ON public.supplier_invoice_items
-- FOR SELECT
-- TO anon
-- USING (true);

COMMENT ON COLUMN public.supplier_invoice_items.input_inventory_id IS 'Once processed, links to the created/updated InputInventory item';
COMMENT ON COLUMN public.supplier_invoice_items.line_total_gross IS 'Calculated: quantity * unit_price_gross';
COMMENT ON COLUMN public.supplier_invoice_items.line_subtotal_after_apportionment IS 'Calculated: LineTotalGross - ApportionedDiscount + ApportionedShipping + ApportionedOtherCharges';
COMMENT ON COLUMN public.supplier_invoice_items.line_total_net IS 'Final cost for this line item, basis for InputInventory.total_purchase_cost';