-- Drop potentially conflicting old policies and set new permissive anon policies for ALL tables

-- Crops Table
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to crops" ON crops;
DROP POLICY IF EXISTS "Allow authenticated users to manage crops" ON crops;
DROP POLICY IF EXISTS "Allow anon users to manage crops" ON crops; -- From a previous iteration
DROP POLICY IF EXISTS "Allow anon full access to crops" ON crops; -- In case this script is run multiple times
CREATE POLICY "Allow anon full access to crops" ON crops
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- SeedBatches Table
ALTER TABLE seed_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to seed_batches" ON seed_batches;
DROP POLICY IF EXISTS "Allow authenticated users to manage seed_batches" ON seed_batches;
DROP POLICY IF EXISTS "Allow anon users to manage seed_batches" ON seed_batches;
DROP POLICY IF EXISTS "Allow anon full access to seed_batches" ON seed_batches;
CREATE POLICY "Allow anon full access to seed_batches" ON seed_batches
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- InputInventory Table
ALTER TABLE input_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to input_inventory" ON input_inventory;
DROP POLICY IF EXISTS "Allow authenticated users to manage input_inventory" ON input_inventory;
DROP POLICY IF EXISTS "Allow anon users to manage input_inventory" ON input_inventory;
DROP POLICY IF EXISTS "Allow anon full access to input_inventory" ON input_inventory;
CREATE POLICY "Allow anon full access to input_inventory" ON input_inventory
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- PlantingLogs Table
ALTER TABLE planting_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to planting_logs" ON planting_logs;
DROP POLICY IF EXISTS "Allow authenticated users to manage planting_logs" ON planting_logs;
DROP POLICY IF EXISTS "Allow anon users to manage planting_logs" ON planting_logs;
DROP POLICY IF EXISTS "Allow anon full access to planting_logs" ON planting_logs;
CREATE POLICY "Allow anon full access to planting_logs" ON planting_logs
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- CultivationLogs Table
ALTER TABLE cultivation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to cultivation_logs" ON cultivation_logs;
DROP POLICY IF EXISTS "Allow authenticated users to manage cultivation_logs" ON cultivation_logs;
DROP POLICY IF EXISTS "Allow anon users to manage cultivation_logs" ON cultivation_logs;
DROP POLICY IF EXISTS "Allow anon full access to cultivation_logs" ON cultivation_logs;
CREATE POLICY "Allow anon full access to cultivation_logs" ON cultivation_logs
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- HarvestLogs Table
ALTER TABLE harvest_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to harvest_logs" ON harvest_logs;
DROP POLICY IF EXISTS "Allow authenticated users to manage harvest_logs" ON harvest_logs;
DROP POLICY IF EXISTS "Allow anon users to manage harvest_logs" ON harvest_logs;
DROP POLICY IF EXISTS "Allow anon full access to harvest_logs" ON harvest_logs;
CREATE POLICY "Allow anon full access to harvest_logs" ON harvest_logs
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Customers Table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated users to manage customers" ON customers;
DROP POLICY IF EXISTS "Allow anon users to manage customers" ON customers;
DROP POLICY IF EXISTS "Allow anon full access to customers" ON customers;
CREATE POLICY "Allow anon full access to customers" ON customers
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Sales Table
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to sales" ON sales;
DROP POLICY IF EXISTS "Allow authenticated users to manage sales" ON sales;
DROP POLICY IF EXISTS "Allow anon users to manage sales" ON sales;
DROP POLICY IF EXISTS "Allow anon full access to sales" ON sales;
CREATE POLICY "Allow anon full access to sales" ON sales
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- SaleItems Table
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to sale_items" ON sale_items;
DROP POLICY IF EXISTS "Allow authenticated users to manage sale_items" ON sale_items;
DROP POLICY IF EXISTS "Allow anon users to manage sale_items" ON sale_items;
DROP POLICY IF EXISTS "Allow anon full access to sale_items" ON sale_items;
CREATE POLICY "Allow anon full access to sale_items" ON sale_items
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Invoices Table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to invoices" ON invoices;
DROP POLICY IF EXISTS "Allow authenticated users to manage invoices" ON invoices;
DROP POLICY IF EXISTS "Allow anon users to manage invoices" ON invoices;
DROP POLICY IF EXISTS "Allow anon full access to invoices" ON invoices;
CREATE POLICY "Allow anon full access to invoices" ON invoices
    FOR ALL TO anon USING (true) WITH CHECK (true);

SELECT 'RLS policies for anon role updated for all tables.' AS status;