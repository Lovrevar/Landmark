/*
  # Create Accounting Companies Table
  
  This migration creates the accounting_companies table for tracking multiple companies
  under the Landmark umbrella, each with its own financial tracking.

  ## New Tables
  
  1. `accounting_companies`
    - `id` (uuid, primary key) - Unique company identifier
    - `name` (text) - Company name
    - `oib` (text) - Croatian tax identification number (OIB)
    - `initial_balance` (numeric) - Starting balance for the company
    - `created_at` (timestamptz) - When the company was added
    - `updated_at` (timestamptz) - Last update timestamp
  
  ## Security
  
  - Enable RLS on `accounting_companies` table
  - Add policies for authenticated users to manage companies
  
  ## Indexes
  
  - Index on `oib` for quick lookups
  - Index on `name` for search functionality
*/

-- Create accounting_companies table
CREATE TABLE IF NOT EXISTS accounting_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  oib text NOT NULL UNIQUE,
  initial_balance numeric DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounting_companies_oib ON accounting_companies(oib);
CREATE INDEX IF NOT EXISTS idx_accounting_companies_name ON accounting_companies(name);

-- Enable RLS
ALTER TABLE accounting_companies ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view companies"
  ON accounting_companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert companies"
  ON accounting_companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update companies"
  ON accounting_companies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete companies"
  ON accounting_companies FOR DELETE
  TO authenticated
  USING (true);

-- Add company_id to accounting_invoices if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE accounting_invoices 
    ADD COLUMN company_id uuid REFERENCES accounting_companies(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_accounting_invoices_company_id 
    ON accounting_invoices(company_id);
  END IF;
END $$;