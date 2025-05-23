-- Add payment_method, payment_status, and amount_paid columns to sales table
ALTER TABLE public.sales
ADD COLUMN payment_method TEXT,
ADD COLUMN payment_status TEXT,
ADD COLUMN amount_paid NUMERIC(10, 2) DEFAULT 0.00;

-- Optional: Add check constraints for the new enum-like fields
-- ALTER TABLE public.sales
-- ADD CONSTRAINT check_sale_payment_method CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'on_account', 'other'));
-- ALTER TABLE public.sales
-- ADD CONSTRAINT check_sale_payment_status CHECK (payment_status IN ('paid', 'unpaid', 'partially_paid'));

-- Note: The Dexie upgrade function in db.ts (version 24) sets defaults for these fields
-- for records in the local IndexedDB.
-- For records already existing in your Supabase 'sales' table before this migration,
-- they will have NULL for payment_method and payment_status, and 0.00 for amount_paid (due to DEFAULT).
-- If you want to retroactively apply defaults to old records in Supabase similar to Dexie:
-- UPDATE public.sales SET payment_method = 'on_account' WHERE payment_method IS NULL;
-- UPDATE public.sales SET payment_status = 'unpaid' WHERE payment_status IS NULL;
-- (amount_paid already defaults to 0.00)

-- Ensure RLS policies are still appropriate. Adding columns typically doesn't break existing RLS
-- unless policies are very specific about column access.