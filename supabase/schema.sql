-- Enable RLS
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Create Crop table
CREATE TABLE crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  variety TEXT, -- e.g., Cherry, Roma for Tomato
  type TEXT, -- e.g., Tomato, Carrot, Spinach (Category)
  notes TEXT, -- General notes for the crop
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to crops" ON crops FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage crops" ON crops FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to manage crops" ON crops FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');


-- Create SeedBatch table
CREATE TABLE seed_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID REFERENCES crops(id) ON DELETE CASCADE,
  batch_code TEXT UNIQUE NOT NULL, -- For traceability
  -- variety TEXT, -- REMOVED: Variety is now part of the Crop entity to which crop_id links
  supplier TEXT,
  purchase_date DATE,
  initial_quantity NUMERIC, -- e.g., number of seeds or weight
  current_quantity NUMERIC, -- Added to track available quantity after plantings
  quantity_unit TEXT, -- e.g., 'seeds', 'grams', 'kg'
  estimated_seeds_per_sowing_unit NUMERIC, -- e.g., if unit is 'grams', this is seeds/gram. Optional.
  total_purchase_cost NUMERIC, -- Cost for the initial quantity of the seed batch
  organic_status TEXT, -- e.g., "Certified Organic", "Untreated", "Conventional"
  notes TEXT,
  qr_code_data TEXT, -- For storing QR code content/identifier
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE seed_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to seed_batches" ON seed_batches FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage seed_batches" ON seed_batches FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to manage seed_batches" ON seed_batches FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Create InputInventory table (for fertilizers, pesticides, etc.)
CREATE TABLE input_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., Organic Fertilizer X, Neem Oil
  type TEXT, -- e.g., Fertilizer, Pesticide, Soil Amendment
  supplier TEXT,
  purchase_date DATE,
  initial_quantity NUMERIC,
  current_quantity NUMERIC,
  quantity_unit TEXT, -- e.g., 'kg', 'L', 'bags'
  total_purchase_cost NUMERIC, -- Renamed from cost_per_unit
  supplier_invoice_number TEXT, -- New field
  notes TEXT,
  qr_code_data TEXT, -- For storing QR code content/identifier
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE input_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to input_inventory" ON input_inventory FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage input_inventory" ON input_inventory FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to manage input_inventory" ON input_inventory FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Create PlantingLog table
-- This table will now represent Field Plantings.
-- It can be sourced from a SeedlingProductionLog or directly from a SeedBatch.
CREATE TABLE planting_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seedling_production_log_id UUID REFERENCES seedling_production_logs(id) ON DELETE SET NULL, -- New FK
  seed_batch_id UUID REFERENCES seed_batches(id) ON DELETE SET NULL, -- For direct sowing
  planting_date DATE NOT NULL, -- Date of planting into the field
  location_description TEXT, -- General field location
  plot_affected TEXT, -- Specific field plot
  quantity_planted NUMERIC NOT NULL, -- Number of seedlings transplanted or seeds sown
  quantity_unit TEXT, -- e.g., 'seedlings', 'seeds'
  expected_harvest_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_planting_source CHECK (
    -- Allows (NULL, NULL), (Value, NULL), (NULL, Value)
    -- Disallows (Value, Value)
    NOT (seedling_production_log_id IS NOT NULL AND seed_batch_id IS NOT NULL)
  )
);
ALTER TABLE planting_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to planting_logs" ON planting_logs FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage planting_logs" ON planting_logs FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to manage planting_logs" ON planting_logs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Create CultivationLog table
CREATE TABLE cultivation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_log_id UUID REFERENCES planting_logs(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  activity_type TEXT NOT NULL, -- e.g., Weeding, Watering, Pest Control, Fertilizing
  plot_affected TEXT, -- Specific plot identifier for the activity
  input_inventory_id UUID REFERENCES input_inventory(id) ON DELETE SET NULL, -- Optional: if an input was used
  input_quantity_used NUMERIC, -- Optional
  input_quantity_unit TEXT, -- Optional
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE cultivation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to cultivation_logs" ON cultivation_logs FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage cultivation_logs" ON cultivation_logs FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to manage cultivation_logs" ON cultivation_logs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Create HarvestLog table
CREATE TABLE harvest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_log_id UUID REFERENCES planting_logs(id) ON DELETE CASCADE,
  harvest_date DATE NOT NULL,
  quantity_harvested NUMERIC NOT NULL,
  quantity_unit TEXT NOT NULL, -- e.g., 'kg', 'pieces', 'bunches'
  quality_grade TEXT, -- Optional: e.g., Grade A, Grade B
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE harvest_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to harvest_logs" ON harvest_logs FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage harvest_logs" ON harvest_logs FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to manage harvest_logs" ON harvest_logs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Create Customer table (optional for sales)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  customer_type TEXT, -- 'Individual' or 'Commercial'
  contact_info TEXT, -- e.g., phone, email (optional as per PRD)
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage customers" ON customers FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to manage customers" ON customers FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');


-- Create Sale table
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL, -- Optional customer
  sale_date DATE NOT NULL,
  total_amount NUMERIC, -- Was: GENERATED ALWAYS AS (...) STORED. This will now be calculated by the app or a view.
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to sales" ON sales FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage sales" ON sales FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to manage sales" ON sales FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Create SaleItem table (line items for a sale)
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  -- Linking directly to harvest_log or crop can be an option.
  -- For simplicity and traceability to a specific harvest:
  harvest_log_id UUID REFERENCES harvest_logs(id) ON DELETE SET NULL,
  -- Alternatively, if selling from general stock not tied to a specific harvest:
  -- crop_id UUID REFERENCES crops(id),
  -- product_description TEXT, -- If not directly linking to harvest/crop
  quantity_sold NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL, -- Price before discount
  discount_type TEXT CHECK (discount_type IN ('Amount', 'Percentage')), -- Can be NULL
  discount_value NUMERIC, -- Can be NULL
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false, -- Usually sale items are deleted with the sale, but for completeness
  deleted_at TIMESTAMPTZ
);
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to sale_items" ON sale_items FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage sale_items" ON sale_items FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to manage sale_items" ON sale_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');


-- Create Invoice table
-- PRD: "Invoices are immutable once generated. No email or online distribution included."
-- PRD: "Invoice is auto-generated (PDF) with: K.K. Biofresh branding, Customer & sale details, Product list with prices and totals"
-- Storing PDF URL assumes PDF generation happens elsewhere and URL is stored.
-- For a fully integrated solution, PDF generation logic would be part of the app.
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID UNIQUE REFERENCES sales(id) ON DELETE CASCADE, -- Each sale has one invoice
  invoice_number TEXT UNIQUE NOT NULL, -- Auto-generated or manually assigned format
  invoice_date DATE NOT NULL,
  -- pdf_content BYTEA, -- Option to store PDF blob directly in DB
  pdf_url TEXT, -- Option to store URL to a generated PDF (e.g., in Supabase Storage)
  status TEXT DEFAULT 'generated', -- e.g., generated, (paid - though PRD implies no payment tracking)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false, -- Invoices are immutable, but for sync consistency
  deleted_at TIMESTAMPTZ
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to invoices" ON invoices FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage invoices" ON invoices FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to manage invoices" ON invoices FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Create Trees table
CREATE TABLE trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT, -- e.g., T-001, or a human-readable name
  species TEXT,    -- e.g., Olive, Lemon, Apple
  variety TEXT,
  planting_date DATE,
  location_description TEXT, -- General location
  plot_affected TEXT, -- Specific plot or coordinates
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE trees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to trees" ON trees FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage trees" ON trees FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create SeedlingProductionLog table
CREATE TABLE seedling_production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_batch_id UUID NOT NULL REFERENCES seed_batches(id) ON DELETE RESTRICT,
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
  sowing_date DATE NOT NULL,
  quantity_sown_value NUMERIC NOT NULL, -- Renamed from quantity_seeds_sown
  sowing_unit_from_batch TEXT, -- Renamed from seed_quantity_unit
  estimated_total_individual_seeds_sown NUMERIC, -- New field
  nursery_location TEXT,
  expected_seedlings NUMERIC,
  actual_seedlings_produced NUMERIC DEFAULT 0,
  current_seedlings_available NUMERIC DEFAULT 0,
  ready_for_transplant_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE seedling_production_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to seedling_production_logs" ON seedling_production_logs FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage seedling_production_logs" ON seedling_production_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create Reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_log_id UUID REFERENCES planting_logs(id) ON DELETE SET NULL, -- Optional
  activity_type TEXT NOT NULL, -- e.g., "Watering", "Pest Control", "Fertilize", "Custom Task"
  reminder_date TIMESTAMPTZ NOT NULL, -- Using TIMESTAMPTZ for date and potentially time
  notes TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to reminders" ON reminders FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage reminders" ON reminders FOR ALL TO anon USING (true) WITH CHECK (true);

-- Functions to update `updated_at` columns
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all tables with an updated_at column
DO $$
DECLARE
  t_name TEXT;
BEGIN
  FOR t_name IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_schema = 'public')
  LOOP
    EXECUTE format('CREATE TRIGGER set_timestamp
                    BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();', t_name);
  END LOOP;
END;
$$;

-- Note: FinancialReport is an aggregated view, will be handled by queries/views later.
-- For offline sync, these tables will be replicated in IndexedDB.
-- RLS policies are basic for now (public read, auth write).
-- Since PRD states "single-user use by the farm owner and does not require authentication",
-- the RLS policies might be simplified or auth might be handled by a single, pre-defined user/role if Supabase is used.
-- However, the PRD also mentions "Supabase RLS for sync" under security.
-- For a true single-user desktop app without auth, RLS might be set to allow all for a specific API key if that's how Supabase is configured.
-- Given "auth.role() = 'authenticated'", it implies some form of authentication will be set up, even if it's a single fixed user.
-- For a truly unauthenticated single-user app that syncs, the RLS would need to be very permissive or use a service_role key for writes,
-- which is generally not recommended for client-side operations.
-- The current RLS assumes a logged-in user context. If no login, these need adjustment.
-- The PRD says "No authentication or login system" (line 162) but also "Supabase RLS for sync" (line 146).
-- This is a contradiction. Assuming for now that a single, non-interactive "user" will be used for RLS.
-- If it's truly no auth, then policies would be `USING (true)` for all actions, which is insecure for a public Supabase instance.
-- Let's assume a single 'user' context for RLS for now, as it's safer.
-- The client would need to authenticate as this single user.

-- Example of a view for Financial Reports (can be expanded)
CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT
    s.sale_date,
    SUM(si.quantity_sold * si.price_per_unit) as total_revenue
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.sale_date
ORDER BY s.sale_date DESC;

CREATE OR REPLACE VIEW monthly_sales_summary AS
SELECT
    DATE_TRUNC('month', s.sale_date) as sale_month,
    SUM(si.quantity_sold * si.price_per_unit) as total_revenue
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
GROUP BY sale_month
ORDER BY sale_month DESC;

-- To track costs, we'd need to associate costs with planting/cultivation/inputs.
-- For example, cost from input_inventory used in cultivation_logs.
-- This PRD is simplified, so detailed cost tracking might be out of scope for v1 beyond input purchase costs.