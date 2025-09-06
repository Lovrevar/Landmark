/*
  # Add Investment role and financial tables

  1. User Role Update
    - Add 'Investment' to the existing users role check constraint

  2. New Tables
    - `banks`
      - `id` (uuid, primary key)
      - `name` (text, bank name)
      - `contact_person` (text, main contact)
      - `contact_email` (text, contact email)
      - `contact_phone` (text, contact phone)
      - `total_credit_limit` (numeric, total credit available)
      - `outstanding_debt` (numeric, current debt amount)
      - `available_funds` (numeric, remaining credit)
      - `interest_rate` (numeric, average interest rate)
      - `relationship_start` (date, when relationship began)
      - `notes` (text, additional notes)
      - `created_at` (timestamp)

    - `investors`
      - `id` (uuid, primary key)
      - `name` (text, investor name)
      - `type` (text, investor type: individual/institutional/fund/government)
      - `contact_person` (text, main contact)
      - `contact_email` (text, contact email)
      - `contact_phone` (text, contact phone)
      - `total_invested` (numeric, total amount invested)
      - `expected_return` (numeric, expected return percentage)
      - `investment_start` (date, when investment relationship began)
      - `risk_profile` (text, conservative/moderate/aggressive)
      - `preferred_sectors` (text, preferred investment sectors)
      - `notes` (text, additional notes)
      - `created_at` (timestamp)

    - `bank_credits`
      - `id` (uuid, primary key)
      - `bank_id` (uuid, foreign key to banks)
      - `project_id` (uuid, foreign key to projects, nullable)
      - `credit_type` (text, type of credit facility)
      - `amount` (numeric, credit amount)
      - `interest_rate` (numeric, interest rate)
      - `start_date` (date, credit start date)
      - `maturity_date` (date, credit maturity date)
      - `outstanding_balance` (numeric, remaining balance)
      - `monthly_payment` (numeric, monthly payment amount)
      - `status` (text, active/paid/defaulted)
      - `purpose` (text, purpose of credit)
      - `created_at` (timestamp)

    - `project_investments`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `investor_id` (uuid, foreign key to investors, nullable)
      - `bank_id` (uuid, foreign key to banks, nullable)
      - `investment_type` (text, equity/loan/grant/bond)
      - `amount` (numeric, investment amount)
      - `percentage_stake` (numeric, ownership percentage)
      - `expected_return` (numeric, expected return percentage)
      - `investment_date` (date, investment date)
      - `maturity_date` (date, maturity date, nullable)
      - `status` (text, active/completed/defaulted)
      - `terms` (text, investment terms)
      - `created_at` (timestamp)

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to access all data
*/

-- Update users table role constraint to include Investment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'users' AND constraint_name = 'users_role_check'
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
  USING (true)
  WITH CHECK (true);

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
  USING (true)
  WITH CHECK (true);

-- Create bank_credits table
CREATE TABLE IF NOT EXISTS bank_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  credit_type text DEFAULT 'term_loan' CHECK (credit_type = ANY (ARRAY['term_loan'::text, 'line_of_credit'::text, 'construction_loan'::text, 'bridge_loan'::text])),
  amount numeric(15,2) NOT NULL,
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
  USING (true)
  WITH CHECK (true);

-- Create project_investments table
CREATE TABLE IF NOT EXISTS project_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  investor_id uuid REFERENCES investors(id) ON DELETE SET NULL,
  bank_id uuid REFERENCES banks(id) ON DELETE SET NULL,
  investment_type text DEFAULT 'equity' CHECK (investment_type = ANY (ARRAY['equity'::text, 'loan'::text, 'grant'::text, 'bond'::text])),
  amount numeric(15,2) NOT NULL,
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
  USING (true)
  WITH CHECK (true);