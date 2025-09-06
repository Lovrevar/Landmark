/*
  # Add Investment Role and Financial Tables

  1. Role Updates
    - Add 'Investment' to users role constraint
  
  2. New Tables
    - `banks` - Banking relationships and credit facilities
    - `investors` - Investment partners and equity investors
    - `bank_credits` - Individual credit facilities from banks
    - `project_investments` - Investments in specific projects
  
  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Update user role constraint to include Investment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_role_check' 
    AND table_name = 'users'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Sales'::text, 'Supervision'::text, 'Investment'::text]));
  END IF;
END $$;

-- Create banks table
CREATE TABLE IF NOT EXISTS banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  contact_email text,
  contact_phone text,
  total_credit_limit numeric(15,2) DEFAULT 0,
  outstanding_debt numeric(15,2) DEFAULT 0,
  available_funds numeric(15,2) DEFAULT 0,
  interest_rate numeric(5,2) DEFAULT 0,
  relationship_start date,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access banks"
  ON banks
  FOR ALL
  TO authenticated
  USING (true);

-- Create investors table
CREATE TABLE IF NOT EXISTS investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'individual' CHECK (type = ANY (ARRAY['individual'::text, 'institutional'::text, 'fund'::text, 'government'::text])),
  contact_person text,
  contact_email text,
  contact_phone text,
  total_invested numeric(15,2) DEFAULT 0,
  expected_return numeric(5,2) DEFAULT 0,
  investment_start date,
  risk_profile text DEFAULT 'moderate' CHECK (risk_profile = ANY (ARRAY['conservative'::text, 'moderate'::text, 'aggressive'::text])),
  preferred_sectors text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE investors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access investors"
  ON investors
  FOR ALL
  TO authenticated
  USING (true);

-- Create bank_credits table
CREATE TABLE IF NOT EXISTS bank_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  credit_type text DEFAULT 'term_loan' CHECK (credit_type = ANY (ARRAY['term_loan'::text, 'line_of_credit'::text, 'construction_loan'::text, 'bridge_loan'::text])),
  amount numeric(15,2) DEFAULT 0,
  interest_rate numeric(5,2) DEFAULT 0,
  start_date date NOT NULL,
  maturity_date date,
  outstanding_balance numeric(15,2) DEFAULT 0,
  monthly_payment numeric(15,2) DEFAULT 0,
  status text DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::text, 'paid'::text, 'defaulted'::text])),
  purpose text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bank_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access bank credits"
  ON bank_credits
  FOR ALL
  TO authenticated
  USING (true);

-- Create project_investments table
CREATE TABLE IF NOT EXISTS project_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  investor_id uuid REFERENCES investors(id) ON DELETE SET NULL,
  bank_id uuid REFERENCES banks(id) ON DELETE SET NULL,
  investment_type text DEFAULT 'equity' CHECK (investment_type = ANY (ARRAY['equity'::text, 'loan'::text, 'grant'::text, 'bond'::text])),
  amount numeric(15,2) DEFAULT 0,
  percentage_stake numeric(5,2) DEFAULT 0,
  expected_return numeric(5,2) DEFAULT 0,
  investment_date date NOT NULL,
  maturity_date date,
  status text DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'defaulted'::text])),
  terms text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access project investments"
  ON project_investments
  FOR ALL
  TO authenticated
  USING (true);