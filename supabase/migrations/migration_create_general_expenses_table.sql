CREATE TABLE general_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type TEXT NOT NULL CHECK (service_type IN ('WATER', 'ELECTRICITY', 'TELEPHONE', 'FIELD_TAXES', 'INTERNET', 'VEHICLE_MAINTENANCE', 'OTHER')),
    category TEXT,
    provider TEXT,
    bill_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PAID', 'PARTIALLY_PAID')),
    payment_date DATE,
    payment_amount NUMERIC CHECK (payment_amount IS NULL OR payment_amount >= 0),
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted SMALLINT DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    deleted_at TIMESTAMPTZ,
    _synced SMALLINT DEFAULT 0 CHECK (_synced IN (0, 1)),
    _last_modified BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_general_expenses_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   NEW._last_modified = (EXTRACT(EPOCH FROM NOW()) * 1000);
   NEW._synced = 0; -- Mark as unsynced on update
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on row update
CREATE TRIGGER update_general_expenses_updated_at
BEFORE UPDATE ON general_expenses
FOR EACH ROW
EXECUTE FUNCTION update_general_expenses_updated_at_column();

-- Enable RLS
ALTER TABLE general_expenses ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
-- Allow users to manage their own general expenses
CREATE POLICY "Allow individual insert access to general_expenses" ON general_expenses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow individual select access to general_expenses" ON general_expenses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow individual update access to general_expenses" ON general_expenses FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow individual delete access to general_expenses" ON general_expenses FOR DELETE USING (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_general_expenses_service_type ON general_expenses(service_type);
CREATE INDEX idx_general_expenses_category ON general_expenses(category);
CREATE INDEX idx_general_expenses_bill_date ON general_expenses(bill_date);
CREATE INDEX idx_general_expenses_due_date ON general_expenses(due_date);
CREATE INDEX idx_general_expenses_payment_status ON general_expenses(payment_status);
CREATE INDEX idx_general_expenses_is_deleted ON general_expenses(is_deleted);
CREATE INDEX idx_general_expenses_last_modified ON general_expenses(_last_modified);

COMMENT ON TABLE general_expenses IS 'Stores general operational expenses and utility bills.';
COMMENT ON COLUMN general_expenses.service_type IS 'Type of service for the expense (e.g., WATER, ELECTRICITY).';
COMMENT ON COLUMN general_expenses.category IS 'Category of the expense (e.g., Utilities, Farm Operations, Admin).';
COMMENT ON COLUMN general_expenses.provider IS 'Name of the service provider or vendor.';
COMMENT ON COLUMN general_expenses.bill_date IS 'Date the bill or expense was issued/incurred.';
COMMENT ON COLUMN general_expenses.due_date IS 'Date the payment for the expense is due.';
COMMENT ON COLUMN general_expenses.amount IS 'Total amount of the bill or expense.';
COMMENT ON COLUMN general_expenses.payment_status IS 'Current payment status of the expense (UNPAID, PAID, PARTIALLY_PAID).';
COMMENT ON COLUMN general_expenses.payment_date IS 'Date the expense was paid.';
COMMENT ON COLUMN general_expenses.payment_amount IS 'Amount that was actually paid.';
COMMENT ON COLUMN general_expenses.reference_number IS 'Invoice number, account number, or other reference for the expense.';
COMMENT ON COLUMN general_expenses.notes IS 'Additional notes or details about the expense.';