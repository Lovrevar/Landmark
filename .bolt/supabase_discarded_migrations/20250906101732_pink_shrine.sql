/*
  # Add Investment Role and Financial Tables

  1. New Tables
    - `banks` - Track bank relationships and credit facilities
      - `id` (uuid, primary key)
      - `name` (text, bank name)
      - `contact_person` (text, relationship manager)
      - `contact_email` (text)
      - `contact_phone` (text)
      - `total_credit_limit` (numeric, total available credit)
      - `outstanding_debt` (numeric, current debt amount)
      - `available_funds` (numeric, remaining credit available)
      - `interest_rate` (numeric, average interest rate)
      - `relationship_start` (date, when relationship began)
      - `notes` (text, additional information)
      - `created_at` (timestamp)

    - `bank_credits` - Individual credit facilities from banks
      - `id` (uuid, primary key)
      - `bank_id` (uuid, foreign key to banks)
      - `project_id` (uuid, foreign key to projects, nullable)
      - `credit_type` (text, type of credit facility)
      - `amount` (numeric, credit amount)
      - `interest_rate` (numeric, interest rate for this credit)
      - `start_date` (date, when credit was approved)
      - `maturity_date` (date, when credit expires)
      - `outstanding_balance` (numeric, current outstanding amount)
      - `monthly_payment` (numeric, required monthly payment)
      - `status` (text, active/paid/defaulted)
      - `purpose` (text, what the credit is for)
      - `created_at` (timestamp)

    - `investors` - Track individual and institutional investors
      - `id` (uuid, primary key)
      - `name` (text, investor name)
      - `type` (text, individual/institutional/fund)
      - `contact_person` (text, main contact)
      - `contact_email` (text)
      - `contact_phone` (text)
      - `total_invested` (numeric, total amount invested)
      - `expected_return` (numeric, expected return percentage)
      - `investment_start` (date, when they started investing)
      - `risk_profile` (text, conservative/moderate/aggressive)
      - `preferred_sectors` (text, preferred investment sectors)
      - `notes` (text, additional information)
      - `created_at` (timestamp)

    - `project_investments` - Track investments in specific projects
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `investor_id` (uuid, foreign key to investors, nullable)
      - `bank_id` (uuid, foreign key to banks, nullable)
      - `investment_type` (text, equity/loan/grant)
      - `amount` (numeric, investment amount)
      - `percentage_stake` (numeric, ownership percentage if equity)
      - `expected_return` (numeric, expected return percentage)
      - `investment_date` (date, when investment was made)
      - `maturity_date` (date, when investment matures, nullable)
      - `status` (text, active/completed/defaulted)
      - `terms` (text, investment terms and conditions)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to access financial data

  3. Changes
    - Update users table to include 'Investment' role
*/

-- Update users table to include Investment role
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_role_check' 
    AND table_name = 'users'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Sales'::text, 'Supervision'::text, 'Investment'::text]));

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

-- Create bank_credits table
CREATE TABLE IF NOT EXISTS bank_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  credit_type text NOT NULL DEFAULT 'term_loan',
  amount numeric(15,2) NOT NULL DEFAULT 0,
  interest_rate numeric(5,2) DEFAULT 0,
  start_date date NOT NULL,
  maturity_date date,
  outstanding_balance numeric(15,2) DEFAULT 0,
  monthly_payment numeric(15,2) DEFAULT 0,
  status text DEFAULT 'active',
  purpose text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT bank_credits_credit_type_check 
    CHECK (credit_type = ANY (ARRAY['term_loan'::text, 'line_of_credit'::text, 'construction_loan'::text, 'bridge_loan'::text])),
  CONSTRAINT bank_credits_status_check 
    CHECK (status = ANY (ARRAY['active'::text, 'paid'::text, 'defaulted'::text]))
);

ALTER TABLE bank_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access bank credits"
  ON bank_credits
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create investors table
CREATE TABLE IF NOT EXISTS investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'individual',
  contact_person text,
  contact_email text,
  contact_phone text,
  total_invested numeric(15,2) DEFAULT 0,
  expected_return numeric(5,2) DEFAULT 0,
  investment_start date,
  risk_profile text DEFAULT 'moderate',
  preferred_sectors text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT investors_type_check 
    CHECK (type = ANY (ARRAY['individual'::text, 'institutional'::text, 'fund'::text, 'government'::text])),
  CONSTRAINT investors_risk_profile_check 
    CHECK (risk_profile = ANY (ARRAY['conservative'::text, 'moderate'::text, 'aggressive'::text]))
);

ALTER TABLE investors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access investors"
  ON investors
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
  investment_type text DEFAULT 'equity',
  amount numeric(15,2) NOT NULL DEFAULT 0,
  percentage_stake numeric(5,2) DEFAULT 0,
  expected_return numeric(5,2) DEFAULT 0,
  investment_date date NOT NULL DEFAULT CURRENT_DATE,
  maturity_date date,
  status text DEFAULT 'active',
  terms text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT project_investments_investment_type_check 
    CHECK (investment_type = ANY (ARRAY['equity'::text, 'loan'::text, 'grant'::text, 'bond'::text])),
  CONSTRAINT project_investments_status_check 
    CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'defaulted'::text])),
  CONSTRAINT project_investments_source_check 
    CHECK ((investor_id IS NOT NULL) OR (bank_id IS NOT NULL))
);

ALTER TABLE project_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access project investments"
  ON project_investments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert sample data for banks
INSERT INTO banks (name, contact_person, contact_email, contact_phone, total_credit_limit, outstanding_debt, available_funds, interest_rate, relationship_start, notes) VALUES
('First National Bank', 'Robert Chen', 'robert.chen@firstnational.com', '+1-555-0201', 5000000, 2800000, 2200000, 4.5, '2023-01-15', 'Primary construction financing partner'),
('Capital Trust Bank', 'Sarah Mitchell', 'sarah.mitchell@capitaltrust.com', '+1-555-0202', 3000000, 1200000, 1800000, 5.2, '2023-06-10', 'Secondary lender for bridge financing'),
('Metro Commercial Bank', 'David Park', 'david.park@metrocommercial.com', '+1-555-0203', 2500000, 800000, 1700000, 4.8, '2024-02-01', 'Specialized in real estate development loans');

-- Insert sample data for investors
INSERT INTO investors (name, type, contact_person, contact_email, contact_phone, total_invested, expected_return, investment_start, risk_profile, preferred_sectors, notes) VALUES
('Pacific Real Estate Group', 'institutional', 'Jennifer Walsh', 'jennifer.walsh@pacificrealestate.com', '+1-555-0301', 8500000, 12.5, '2023-01-01', 'moderate', 'Residential, Commercial', 'Long-term strategic partner'),
('Innovation Partners Fund', 'fund', 'Michael Torres', 'michael.torres@innovationpartners.com', '+1-555-0302', 6200000, 15.0, '2023-03-15', 'aggressive', 'Mixed-use, Technology', 'Focus on innovative projects'),
('Coastal Investments LLC', 'institutional', 'Lisa Anderson', 'lisa.anderson@coastalinvestments.com', '+1-555-0303', 4800000, 10.8, '2023-08-20', 'conservative', 'Residential', 'Prefers established markets'),
('Thomas Richardson', 'individual', 'Thomas Richardson', 'thomas.richardson@email.com', '+1-555-0304', 2100000, 14.0, '2024-01-10', 'moderate', 'Luxury Residential', 'High-net-worth individual investor');

-- Insert sample bank credits
INSERT INTO bank_credits (bank_id, project_id, credit_type, amount, interest_rate, start_date, maturity_date, outstanding_balance, monthly_payment, status, purpose) 
SELECT 
  b.id,
  p.id,
  'construction_loan',
  CASE 
    WHEN p.name = 'Sunset Towers Residential Complex' THEN 3500000
    WHEN p.name = 'Green Valley Office Park' THEN 2200000
    ELSE 1800000
  END,
  CASE 
    WHEN b.name = 'First National Bank' THEN 4.5
    WHEN b.name = 'Capital Trust Bank' THEN 5.2
    ELSE 4.8
  END,
  p.start_date,
  p.end_date,
  CASE 
    WHEN p.name = 'Sunset Towers Residential Complex' THEN 2800000
    WHEN p.name = 'Green Valley Office Park' THEN 1200000
    ELSE 800000
  END,
  CASE 
    WHEN p.name = 'Sunset Towers Residential Complex' THEN 45000
    WHEN p.name = 'Green Valley Office Park' THEN 28000
    ELSE 22000
  END,
  'active',
  'Construction financing for ' || p.name
FROM banks b
CROSS JOIN projects p
WHERE (b.name = 'First National Bank' AND p.name = 'Sunset Towers Residential Complex')
   OR (b.name = 'Capital Trust Bank' AND p.name = 'Green Valley Office Park')
   OR (b.name = 'Metro Commercial Bank' AND p.name = 'Marina Bay Shopping Center');

-- Insert sample project investments
INSERT INTO project_investments (project_id, investor_id, investment_type, amount, percentage_stake, expected_return, investment_date, status, terms)
SELECT 
  p.id,
  i.id,
  'equity',
  CASE 
    WHEN p.name = 'Sunset Towers Residential Complex' AND i.name = 'Pacific Real Estate Group' THEN 8500000
    WHEN p.name = 'Green Valley Office Park' AND i.name = 'Innovation Partners Fund' THEN 6200000
    WHEN p.name = 'Marina Bay Shopping Center' AND i.name = 'Coastal Investments LLC' THEN 4800000
    WHEN p.name = 'Tech Campus Phase 1' AND i.name = 'Thomas Richardson' THEN 2100000
    ELSE 0
  END,
  CASE 
    WHEN p.name = 'Sunset Towers Residential Complex' AND i.name = 'Pacific Real Estate Group' THEN 45.0
    WHEN p.name = 'Green Valley Office Park' AND i.name = 'Innovation Partners Fund' THEN 38.0
    WHEN p.name = 'Marina Bay Shopping Center' AND i.name = 'Coastal Investments LLC' THEN 32.0
    WHEN p.name = 'Tech Campus Phase 1' AND i.name = 'Thomas Richardson' THEN 15.0
    ELSE 0
  END,
  CASE 
    WHEN i.name = 'Pacific Real Estate Group' THEN 12.5
    WHEN i.name = 'Innovation Partners Fund' THEN 15.0
    WHEN i.name = 'Coastal Investments LLC' THEN 10.8
    WHEN i.name = 'Thomas Richardson' THEN 14.0
    ELSE 0
  END,
  p.start_date,
  'active',
  'Equity investment with profit sharing agreement'
FROM projects p
CROSS JOIN investors i
WHERE (p.name = 'Sunset Towers Residential Complex' AND i.name = 'Pacific Real Estate Group')
   OR (p.name = 'Green Valley Office Park' AND i.name = 'Innovation Partners Fund')
   OR (p.name = 'Marina Bay Shopping Center' AND i.name = 'Coastal Investments LLC')
   OR (p.name = 'Tech Campus Phase 1' AND i.name = 'Thomas Richardson');