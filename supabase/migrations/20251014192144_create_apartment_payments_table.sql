/*
  # Create Apartment Payments Table

  1. New Tables
    - `apartment_payments`
      - `id` (uuid, primary key, auto-generated)
      - `apartment_id` (uuid, foreign key to apartments table)
      - `amount` (numeric, payment amount)
      - `payment_date` (date, optional - when payment was made)
      - `notes` (text, optional - additional payment notes)
      - `created_by` (uuid, optional - user who created the payment)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `apartment_payments` table
    - Add policy for authenticated users to read all apartment payments
    - Add policy for authenticated users to insert apartment payments
    - Add policy for authenticated users to update apartment payments
    - Add policy for authenticated users to delete apartment payments

  3. Foreign Key Constraints
    - apartment_id references apartments(id) with CASCADE DELETE
    - When an apartment is deleted, all associated payments are automatically deleted

  4. Important Notes
    - This table is completely separate from wire_payments (subcontractor payments)
    - No relationship or association with subcontractor payment system
    - Designed specifically for tracking apartment sale payments
*/

-- Create apartment_payments table
CREATE TABLE IF NOT EXISTS apartment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraint with CASCADE DELETE
ALTER TABLE apartment_payments 
DROP CONSTRAINT IF EXISTS apartment_payments_apartment_id_fkey;

ALTER TABLE apartment_payments 
ADD CONSTRAINT apartment_payments_apartment_id_fkey 
FOREIGN KEY (apartment_id) 
REFERENCES apartments(id) 
ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE apartment_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for apartment_payments
CREATE POLICY "Authenticated users can read apartment payments"
  ON apartment_payments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert apartment payments"
  ON apartment_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update apartment payments"
  ON apartment_payments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete apartment payments"
  ON apartment_payments
  FOR DELETE
  TO authenticated
  USING (true);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_apartment_payments_apartment_id 
ON apartment_payments(apartment_id);

CREATE INDEX IF NOT EXISTS idx_apartment_payments_created_at 
ON apartment_payments(created_at DESC);