/*
  # Create Invoice Categories Table

  1. New Tables
    - `invoice_categories`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null) - category name
      - `sort_order` (integer) - for ordering in dropdown
      - `is_active` (boolean, default true) - soft delete flag
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `invoice_categories` table
    - Add policy for authenticated users to read categories

  3. Data
    - Insert all predefined categories
*/

CREATE TABLE IF NOT EXISTS invoice_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read invoice categories"
  ON invoice_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage invoice categories"
  ON invoice_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

INSERT INTO invoice_categories (name, sort_order) VALUES
  ('Prodaja', 1),
  ('IC Priljevi', 2),
  ('Ostali operativni troškovi', 3),
  ('Najam', 4),
  ('Bruto plaće', 5),
  ('Porezi i ostalo (država)', 6),
  ('CAPEX (građenje)', 7),
  ('CAPEX (projektna dokumentacija)', 8),
  ('IC Odljevi', 9),
  ('Eksterno financiranje (priljev)', 10),
  ('Eksterno financiranje (odljev)', 11),
  ('Interno financiranje (priljev)', 12),
  ('Interno financiranje (odljev)', 13),
  ('PS (Početno stanje)', 14),
  ('CAPEX (nabava dugotrajne imovine)', 15),
  ('Ostalo', 16),
  ('Refundacije', 17),
  ('Javni bilježnici', 18),
  ('Uredski troškovi', 19),
  ('Facility management', 20),
  ('Marketing', 21),
  ('Režijski troškovi', 22),
  ('Naknade institucijama', 23),
  ('Pozajmica Ž.P.', 24),
  ('Pozajmica', 25),
  ('Troškovi vozila', 26),
  ('Bruto plaće vanjski', 27),
  ('Prihodi od prodaje', 28),
  ('Ostali prihodi', 29),
  ('Leasing', 30),
  ('Odvjetnici', 31),
  ('Konzultanti', 32),
  ('Reprezentacija', 33),
  ('Troškovi putovanja', 34),
  ('Kredit', 35),
  ('Ovrha', 36)
ON CONFLICT (name) DO NOTHING;
