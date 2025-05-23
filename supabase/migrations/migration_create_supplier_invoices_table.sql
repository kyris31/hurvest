-- Create supplier_invoices table
CREATE TABLE public.supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    total_amount_gross NUMERIC(12, 2), -- Increased precision for totals
    discount_amount NUMERIC(10, 2),
    discount_percentage NUMERIC(5, 2),
    shipping_cost NUMERIC(10, 2),
    other_charges NUMERIC(10, 2),
    subtotal_after_adjustments NUMERIC(12, 2), -- Increased precision
    total_vat_amount NUMERIC(10, 2),
    total_amount_net NUMERIC(12, 2) NOT NULL, -- Increased precision
    currency TEXT DEFAULT 'EUR',
    status TEXT NOT NULL DEFAULT 'draft', -- e.g., draft, pending_processing, processed, paid, cancelled
    notes TEXT,
    file_attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    -- _synced BOOLEAN DEFAULT FALSE, -- _synced is managed by Dexie, not a direct Supabase column typically unless for specific server-side logic
    -- _last_modified TIMESTAMPTZ DEFAULT now() NOT NULL, -- _last_modified is managed by Dexie
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL, -- Added NOT NULL
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint for supplier_id and invoice_number to prevent duplicates
ALTER TABLE public.supplier_invoices
ADD CONSTRAINT unique_supplier_invoice_number UNIQUE (supplier_id, invoice_number);

-- Add indexes for frequently queried columns
CREATE INDEX idx_supplier_invoices_supplier_id ON public.supplier_invoices(supplier_id);
CREATE INDEX idx_supplier_invoices_invoice_date ON public.supplier_invoices(invoice_date);
CREATE INDEX idx_supplier_invoices_status ON public.supplier_invoices(status);

-- RLS policies (adjust as needed)
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage their supplier invoices"
ON public.supplier_invoices
FOR ALL
TO authenticated
USING (true) -- Assuming users can see all supplier invoices for now, or add tenant/user ID logic
WITH CHECK (true);

-- If you need anon users to read, this is an example, but typically supplier invoices are protected.
-- CREATE POLICY "Enable read access for anon users"
-- ON public.supplier_invoices
-- FOR SELECT
-- TO anon
-- USING (true);

COMMENT ON COLUMN public.supplier_invoices.total_amount_gross IS 'Sum of line items before overall discount/VAT';
COMMENT ON COLUMN public.supplier_invoices.subtotal_after_adjustments IS 'Gross - Discount + Shipping + Other Charges (before VAT)';
COMMENT ON COLUMN public.supplier_invoices.total_amount_net IS 'The final amount payable for the invoice (including VAT, after all adjustments)';
COMMENT ON COLUMN public.supplier_invoices.status IS 'Status of the supplier invoice, e.g., draft, pending_processing, processed, paid, cancelled';