-- Create Trees table
CREATE TABLE IF NOT EXISTS trees (
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

-- Enable RLS for the new table
ALTER TABLE trees ENABLE ROW LEVEL SECURITY;

-- Define RLS policies for the new table (adjust as needed for your auth setup)
CREATE POLICY "Allow public read access to trees" ON trees FOR SELECT USING (true);
CREATE POLICY "Allow anon users to manage trees" ON trees FOR ALL TO anon USING (true) WITH CHECK (true);
-- If using authenticated roles:
-- CREATE POLICY "Allow authenticated users to manage trees" ON trees FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Apply the updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_timestamp' AND tgrelid = 'trees'::regclass
  ) THEN
    CREATE TRIGGER set_timestamp
      BEFORE UPDATE ON trees
      FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
  END IF;
END;
$$;

COMMENT ON TABLE trees IS 'Stores information about individual trees or perennial plants.';
COMMENT ON COLUMN trees.identifier IS 'A unique identifier or name for the tree (e.g., T-001, "Front Orchard Apple #3").';
COMMENT ON COLUMN trees.species IS 'The species of the tree (e.g., Olive, Lemon, Apple, Fig).';
COMMENT ON COLUMN trees.variety IS 'The specific variety of the tree species (e.g., Kalamata, Eureka, Fuji).';
COMMENT ON COLUMN trees.planting_date IS 'The date when the tree was planted.';
COMMENT ON COLUMN trees.location_description IS 'A general description of where the tree is located.';
COMMENT ON COLUMN trees.plot_affected IS 'A more specific plot, bed, or coordinate identifier for the tree''s location.';

SELECT 'Migration for trees table applied.' AS status;