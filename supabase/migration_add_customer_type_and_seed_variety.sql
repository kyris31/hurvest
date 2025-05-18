-- Add customer_type to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS customer_type TEXT;

-- Add variety to seed_batches table
ALTER TABLE seed_batches
ADD COLUMN IF NOT EXISTS variety TEXT;

-- Add indexes if these fields will be frequently queried/filtered
CREATE INDEX IF NOT EXISTS idx_customers_customer_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_seed_batches_variety ON seed_batches(variety);

COMMENT ON COLUMN customers.customer_type IS 'Type of customer (e.g., Individual, Commercial)';
COMMENT ON COLUMN seed_batches.variety IS 'Specific variety of the seed';

SELECT 'Migration for customer_type and seed_variety applied.' AS status;