/*
  # Create Contracts Table and Restructure Payment Relationships

  1. New Tables
    - `contracts`
      - `id` (uuid, primary key)
      - `contract_number` (text, unique) - Contract reference number
      - `project_id` (uuid, foreign key to projects) - Associated project
      - `phase_id` (uuid, nullable, foreign key to project_phases) - Associated project phase
      - `subcontractor_id` (uuid, foreign key to subcontractors) - The subcontractor
      - `job_description` (text) - Description of work to be performed
      - `contract_amount` (numeric) - Total contract value
      - `budget_realized` (numeric) - Amount paid so far
      - `start_date` (date) - Contract start date
      - `end_date` (date) - Contract end date/deadline
      - `status` (text) - Contract status: draft, active, completed, terminated
      - `terms` (text, nullable) - Contract terms and conditions
      - `signed` (boolean) - Whether contract is signed
      - `signed_date` (date, nullable) - Date contract was signed
      - `notes` (text, nullable) - Additional notes
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Table Updates
    - Add `contract_id` to `subcontractors` table to link to contracts
    - This maintains backward compatibility while adding the new relationship

  3. Security
    - Enable RLS on `contracts` table
    - Add policies for authenticated users to manage contracts
    - Authenticated users can view all contracts
    - Authenticated users can create, update, and delete contracts

  4. Indexes
    - Add indexes on foreign keys for performance
    - Add index on contract_number for quick lookups
    - Add index on status for filtering

  5. Migration Strategy
    - Create contracts table with all necessary fields
    - For existing subcontractors, we'll create corresponding contracts in a separate data migration
    - The wire_payments table will be updated in the next migration to reference contracts
*/

-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text UNIQUE NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES project_phases(id) ON DELETE SET NULL,
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  job_description text NOT NULL,
  contract_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (contract_amount >= 0),
  budget_realized numeric(15,2) NOT NULL DEFAULT 0 CHECK (budget_realized >= 0),
  start_date date,
  end_date date,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'terminated')),
  terms text DEFAULT '',
  signed boolean DEFAULT false,
  signed_date date,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add contract_id to subcontractors table for backward compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subcontractors' AND column_name = 'contract_id'
  ) THEN
    ALTER TABLE subcontractors ADD COLUMN contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contracts
CREATE POLICY "Authenticated users can view all contracts"
  ON contracts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create contracts"
  ON contracts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contracts"
  ON contracts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contracts"
  ON contracts FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_phase_id ON contracts(phase_id);
CREATE INDEX IF NOT EXISTS idx_contracts_subcontractor_id ON contracts(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_number ON contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contracts_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_contracts_updated_at_trigger
      BEFORE UPDATE ON contracts
      FOR EACH ROW
      EXECUTE FUNCTION update_contracts_updated_at();
  END IF;
END $$;

-- Create function to generate contract numbers
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  contract_num text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM contracts;
  contract_num := 'CNT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(next_num::text, 5, '0');
  RETURN contract_num;
END;
$$ LANGUAGE plpgsql;