/*
  # Create Retail Supplier Types Table

  ## Purpose
  Allow dynamic creation of supplier type categories instead of hardcoded values.

  ## New Tables
  
  1. **retail_supplier_types** - Dynamic supplier type categories
     - `id` (uuid, primary key)
     - `name` (text, unique) - Type name (e.g., Geodet, Arhitekt, etc.)
     - `created_at` (timestamp)
     - `updated_at` (timestamp)

  ## Changes to Existing Tables
  
  1. **retail_suppliers** - Change supplier_type from CHECK constraint to foreign key
     - Remove CHECK constraint on supplier_type
     - Add foreign key to retail_supplier_types
     - Migrate existing values to new table

  ## Security
  - Enable RLS on retail_supplier_types
  - Authenticated users can view all types
  - Authenticated users can create new types

  ## Migration Steps
  1. Create retail_supplier_types table
  2. Insert existing types from CHECK constraint
  3. Add supplier_type_id column to retail_suppliers
  4. Map existing supplier_type values to IDs
  5. Drop old supplier_type column
  6. Rename supplier_type_id to supplier_type_id
*/

-- =====================================================
-- 1. CREATE RETAIL_SUPPLIER_TYPES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS retail_supplier_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 2. INSERT DEFAULT SUPPLIER TYPES
-- =====================================================
INSERT INTO retail_supplier_types (name) VALUES
  ('Geodet'),
  ('Arhitekt'),
  ('Projektant'),
  ('Consultant'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 3. ADD NEW COLUMN TO RETAIL_SUPPLIERS
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_suppliers' AND column_name = 'supplier_type_id'
  ) THEN
    ALTER TABLE retail_suppliers ADD COLUMN supplier_type_id uuid REFERENCES retail_supplier_types(id);
  END IF;
END $$;

-- =====================================================
-- 4. MIGRATE EXISTING DATA
-- =====================================================
UPDATE retail_suppliers rs
SET supplier_type_id = rst.id
FROM retail_supplier_types rst
WHERE rs.supplier_type = rst.name
AND rs.supplier_type_id IS NULL;

-- =====================================================
-- 5. MAKE supplier_type_id NOT NULL
-- =====================================================
ALTER TABLE retail_suppliers ALTER COLUMN supplier_type_id SET NOT NULL;

-- =====================================================
-- 6. DROP OLD supplier_type COLUMN
-- =====================================================
ALTER TABLE retail_suppliers DROP COLUMN IF EXISTS supplier_type;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_retail_suppliers_type_id ON retail_suppliers(supplier_type_id);

-- =====================================================
-- ENABLE RLS
-- =====================================================
ALTER TABLE retail_supplier_types ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - retail_supplier_types
-- =====================================================
CREATE POLICY "Authenticated users can view supplier types"
  ON retail_supplier_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert supplier types"
  ON retail_supplier_types FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update supplier types"
  ON retail_supplier_types FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete supplier types"
  ON retail_supplier_types FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- TRIGGERS - updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_retail_supplier_types_updated_at ON retail_supplier_types;
CREATE TRIGGER update_retail_supplier_types_updated_at
  BEFORE UPDATE ON retail_supplier_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
