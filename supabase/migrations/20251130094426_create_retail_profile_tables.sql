/*
  # Create Retail Profile Tables

  1. New Tables
    - `retail_land_plots` - Zemljišta/Čestice
      - `id` (uuid, primary key)
      - `owner_first_name` (text) - Ime vlasnika zemljišta
      - `owner_last_name` (text) - Prezime vlasnika zemljišta
      - `plot_number` (text) - Broj čestice
      - `total_area_m2` (numeric) - Ukupna površina čestice
      - `purchased_area_m2` (numeric) - Kupljena površina (nekad nije cijela čestica)
      - `price_per_m2` (numeric) - Cijena po m2
      - `total_price` (numeric) - Ukupna cijena zemljišta
      - `payment_date` (date) - Datum plaćanja
      - `payment_status` (text) - Status plaćanja: 'paid', 'pending', 'partial'
      - `notes` (text, nullable) - Dodatne napomene
      - `created_at`, `updated_at` (timestamptz)

    - `retail_customers` - Kupci
      - `id` (uuid, primary key)
      - `name` (text) - Naziv kupca (firma ili osoba)
      - `contact_phone` (text, nullable) - Telefon
      - `contact_email` (text, nullable) - Email
      - `oib` (text, nullable) - OIB
      - `address` (text, nullable) - Adresa
      - `created_at`, `updated_at` (timestamptz)

    - `retail_sales` - Prodaje parcela kupcima
      - `id` (uuid, primary key)
      - `land_plot_id` (uuid, foreign key → retail_land_plots)
      - `customer_id` (uuid, foreign key → retail_customers)
      - `sale_area_m2` (numeric) - Prodana površina
      - `sale_price_per_m2` (numeric) - Cijena prodaje po m2
      - `total_sale_price` (numeric) - Ukupna cijena prodaje
      - `payment_deadline` (date) - Rok plaćanja
      - `paid_amount` (numeric) - Plaćeni iznos
      - `remaining_amount` (numeric) - Preostali iznos za naplatu
      - `payment_status` (text) - Status: 'paid', 'pending', 'partial', 'overdue'
      - `contract_number` (text, nullable) - Broj ugovora
      - `notes` (text, nullable) - Napomene
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage all records

  3. Indexes
    - Add indexes for foreign keys and frequently queried columns
    - Add index on payment_status for faster filtering

  4. Triggers
    - Auto-calculate total_price in retail_land_plots
    - Auto-calculate total_sale_price and remaining_amount in retail_sales
    - Auto-update updated_at timestamp on row changes
*/

-- Create retail_land_plots table
CREATE TABLE IF NOT EXISTS retail_land_plots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_first_name text NOT NULL,
  owner_last_name text NOT NULL,
  plot_number text NOT NULL,
  total_area_m2 numeric NOT NULL CHECK (total_area_m2 > 0),
  purchased_area_m2 numeric NOT NULL CHECK (purchased_area_m2 > 0 AND purchased_area_m2 <= total_area_m2),
  price_per_m2 numeric NOT NULL CHECK (price_per_m2 >= 0),
  total_price numeric GENERATED ALWAYS AS (purchased_area_m2 * price_per_m2) STORED,
  payment_date date,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'partial')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create retail_customers table
CREATE TABLE IF NOT EXISTS retail_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_phone text,
  contact_email text,
  oib text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create retail_sales table
CREATE TABLE IF NOT EXISTS retail_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  land_plot_id uuid NOT NULL REFERENCES retail_land_plots(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES retail_customers(id) ON DELETE RESTRICT,
  sale_area_m2 numeric NOT NULL CHECK (sale_area_m2 > 0),
  sale_price_per_m2 numeric NOT NULL CHECK (sale_price_per_m2 >= 0),
  total_sale_price numeric GENERATED ALWAYS AS (sale_area_m2 * sale_price_per_m2) STORED,
  payment_deadline date NOT NULL,
  paid_amount numeric NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_amount numeric GENERATED ALWAYS AS (sale_area_m2 * sale_price_per_m2 - paid_amount) STORED,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'partial', 'overdue')),
  contract_number text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_retail_sales_land_plot_id ON retail_sales(land_plot_id);
CREATE INDEX IF NOT EXISTS idx_retail_sales_customer_id ON retail_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_retail_sales_payment_status ON retail_sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_retail_land_plots_payment_status ON retail_land_plots(payment_status);
CREATE INDEX IF NOT EXISTS idx_retail_land_plots_plot_number ON retail_land_plots(plot_number);

-- Enable RLS
ALTER TABLE retail_land_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies for retail_land_plots
CREATE POLICY "Authenticated users can view land plots"
  ON retail_land_plots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert land plots"
  ON retail_land_plots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update land plots"
  ON retail_land_plots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete land plots"
  ON retail_land_plots FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for retail_customers
CREATE POLICY "Authenticated users can view customers"
  ON retail_customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON retail_customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON retail_customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete customers"
  ON retail_customers FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for retail_sales
CREATE POLICY "Authenticated users can view sales"
  ON retail_sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales"
  ON retail_sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales"
  ON retail_sales FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sales"
  ON retail_sales FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_retail_land_plots_updated_at ON retail_land_plots;
CREATE TRIGGER update_retail_land_plots_updated_at
  BEFORE UPDATE ON retail_land_plots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_retail_customers_updated_at ON retail_customers;
CREATE TRIGGER update_retail_customers_updated_at
  BEFORE UPDATE ON retail_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_retail_sales_updated_at ON retail_sales;
CREATE TRIGGER update_retail_sales_updated_at
  BEFORE UPDATE ON retail_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();