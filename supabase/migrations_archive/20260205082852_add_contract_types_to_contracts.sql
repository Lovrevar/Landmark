/*
  # Add Contract Types to Contracts Table

  1. New Tables
    - `contract_types`
      - `id` (integer, primary key)
      - `name` (text, unique) - Name of the contract type
      - `description` (text, nullable) - Optional description
      - `is_active` (boolean) - Whether this type is currently in use
      - `created_at` (timestamptz)

  2. Changes
    - Add `contract_type_id` column to `contracts` table
    - Set default value to 0 (razno/miscellaneous)
    - Add foreign key constraint to contract_types
    - Create default 'razno' type

  3. Security
    - Enable RLS on `contract_types` table
    - Add policies for authenticated users to read contract types
    - Only admins/directors can modify contract types

  4. Data Migration
    - Create default 'razno' type with id = 0
    - Set all existing contracts to use the default type
*/

-- Create contract_types table
CREATE TABLE IF NOT EXISTS contract_types (
  id integer PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert default 'razno' type
INSERT INTO contract_types (id, name, description, is_active)
VALUES (0, 'razno', 'Razno / Miscellaneous', true)
ON CONFLICT (id) DO NOTHING;

-- Add contract_type_id column to contracts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'contract_type_id'
  ) THEN
    ALTER TABLE contracts ADD COLUMN contract_type_id integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contracts_contract_type_id_fkey'
    AND table_name = 'contracts'
  ) THEN
    ALTER TABLE contracts 
    ADD CONSTRAINT contracts_contract_type_id_fkey 
    FOREIGN KEY (contract_type_id) 
    REFERENCES contract_types(id);
  END IF;
END $$;

-- Enable RLS on contract_types
ALTER TABLE contract_types ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read contract types
DROP POLICY IF EXISTS "Authenticated users can view contract types" ON contract_types;
CREATE POLICY "Authenticated users can view contract types"
  ON contract_types
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only directors can insert contract types
DROP POLICY IF EXISTS "Directors can insert contract types" ON contract_types;
CREATE POLICY "Directors can insert contract types"
  ON contract_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'admin')
    )
  );

-- Policy: Only directors can update contract types
DROP POLICY IF EXISTS "Directors can update contract types" ON contract_types;
CREATE POLICY "Directors can update contract types"
  ON contract_types
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'admin')
    )
  );

-- Policy: Only directors can delete contract types
DROP POLICY IF EXISTS "Directors can delete contract types" ON contract_types;
CREATE POLICY "Directors can delete contract types"
  ON contract_types
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'admin')
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contracts_contract_type_id ON contracts(contract_type_id);
