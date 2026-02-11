/*
  # Create Hidden Approved Invoices Table

  1. New Tables
    - `hidden_approved_invoices`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key to accounting_invoices.id, unique)
      - `hidden_at` (timestamptz, default now())
      - `hidden_by` (uuid, foreign key to users.id, nullable)
  
  2. Security
    - Enable RLS on `hidden_approved_invoices` table
    - Add policies for authenticated users to:
      - View all hidden invoices
      - Insert new hidden invoices (marking invoices as hidden)
      - Delete hidden invoices (unhiding if needed)
  
  3. Purpose
    - Track which approved supervision invoices have been processed by accounting staff
    - Allows accounting staff to hide invoices from the "Odobrenja" page after processing
    - Invoices remain visible in other parts of the system (Računi, Supervision - Invoices)
*/

-- Create the hidden_approved_invoices table
CREATE TABLE IF NOT EXISTS hidden_approved_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES accounting_invoices(id) ON DELETE CASCADE,
  hidden_at timestamptz DEFAULT now() NOT NULL,
  hidden_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT unique_hidden_invoice UNIQUE (invoice_id)
);

-- Enable RLS
ALTER TABLE hidden_approved_invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all hidden invoices
CREATE POLICY "Authenticated users can view hidden invoices"
  ON hidden_approved_invoices
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can hide invoices
CREATE POLICY "Authenticated users can hide invoices"
  ON hidden_approved_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can unhide invoices (if needed)
CREATE POLICY "Authenticated users can unhide invoices"
  ON hidden_approved_invoices
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hidden_approved_invoices_invoice_id 
  ON hidden_approved_invoices(invoice_id);

CREATE INDEX IF NOT EXISTS idx_hidden_approved_invoices_hidden_at 
  ON hidden_approved_invoices(hidden_at DESC);
