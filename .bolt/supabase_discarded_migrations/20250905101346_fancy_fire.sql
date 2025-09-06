/*
  # Create sales management tables

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `name` (text)
      - `surname` (text)
      - `email` (text, unique)
      - `phone` (text)
      - `address` (text)
      - `bank_account` (text)
      - `id_number` (text, unique)
      - `status` (text) - buyer, interested, lead
      - `created_at` (timestamp)
    
    - `sales`
      - `id` (uuid, primary key)
      - `apartment_id` (uuid, foreign key)
      - `customer_id` (uuid, foreign key)
      - `sale_price` (numeric)
      - `payment_method` (text) - cash, credit, bank_loan, installments
      - `down_payment` (numeric)
      - `total_paid` (numeric)
      - `remaining_amount` (numeric)
      - `next_payment_date` (date)
      - `monthly_payment` (numeric)
      - `sale_date` (date)
      - `contract_signed` (boolean)
      - `notes` (text)
      - `created_at` (timestamp)
    
    - `leads`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key)
      - `project_id` (uuid, foreign key)
      - `apartment_preferences` (text)
      - `budget_range_min` (numeric)
      - `budget_range_max` (numeric)
      - `priority` (text) - high, medium, low
      - `status` (text) - new, contacted, viewing_scheduled, negotiating, closed
      - `last_contact_date` (date)
      - `next_follow_up` (date)
      - `notes` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access sales data
</sql>

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  surname text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  address text,
  bank_account text,
  id_number text UNIQUE,
  status text DEFAULT 'lead' CHECK (status IN ('buyer', 'interested', 'lead')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id uuid NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_price numeric(15,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'bank_loan' CHECK (payment_method IN ('cash', 'credit', 'bank_loan', 'installments')),
  down_payment numeric(15,2) DEFAULT 0,
  total_paid numeric(15,2) DEFAULT 0,
  remaining_amount numeric(15,2) DEFAULT 0,
  next_payment_date date,
  monthly_payment numeric(15,2) DEFAULT 0,
  sale_date date DEFAULT CURRENT_DATE,
  contract_signed boolean DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  apartment_preferences text DEFAULT '',
  budget_range_min numeric(15,2) DEFAULT 0,
  budget_range_max numeric(15,2) DEFAULT 0,
  priority text DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'viewing_scheduled', 'negotiating', 'closed')),
  last_contact_date date,
  next_follow_up date,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can access customers"
  ON customers
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can access sales"
  ON sales
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can access leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);
CREATE INDEX IF NOT EXISTS customers_status_idx ON customers(status);
CREATE INDEX IF NOT EXISTS sales_apartment_id_idx ON sales(apartment_id);
CREATE INDEX IF NOT EXISTS sales_customer_id_idx ON sales(customer_id);
CREATE INDEX IF NOT EXISTS leads_customer_id_idx ON leads(customer_id);
CREATE INDEX IF NOT EXISTS leads_project_id_idx ON leads(project_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);