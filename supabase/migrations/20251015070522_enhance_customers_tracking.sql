/*
  # Enhanced Customer Tracking System
  
  1. Changes to customers table
    - Add `preferences` column (JSONB) to store customer preferences like budget, size, location, etc.
    - Add `last_contact_date` column (timestamptz) to track when customer was last contacted
    - Add `backed_out_reason` column (text) to store reason for backing out
    - Add `notes` column (text) for general notes about the customer
    - Add `priority` column (text) for lead priority (hot, warm, cold)
    - Update status enum to support new categories: 'lead', 'interested', 'hot_lead', 'negotiating', 'buyer', 'backed_out'
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to customers table
DO $$ 
BEGIN
  -- Add preferences column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'preferences'
  ) THEN
    ALTER TABLE customers ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Add last_contact_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'last_contact_date'
  ) THEN
    ALTER TABLE customers ADD COLUMN last_contact_date timestamptz;
  END IF;

  -- Add backed_out_reason column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'backed_out_reason'
  ) THEN
    ALTER TABLE customers ADD COLUMN backed_out_reason text;
  END IF;

  -- Add notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'notes'
  ) THEN
    ALTER TABLE customers ADD COLUMN notes text DEFAULT '';
  END IF;

  -- Add priority column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'priority'
  ) THEN
    ALTER TABLE customers ADD COLUMN priority text DEFAULT 'warm' CHECK (priority IN ('hot', 'warm', 'cold'));
  END IF;
END $$;

-- Create index on last_contact_date for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_last_contact_date ON customers(last_contact_date);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);