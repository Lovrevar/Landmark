/*
  # Update customers table structure

  1. Changes
    - Remove id_number unique constraint (not all customers have ID cards)
    - Add customer_number as auto-generated sequential number
    - Update existing data to have customer numbers

  2. Security
    - Maintain existing RLS policies
*/

-- Add customer_number column with auto-increment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'customer_number'
  ) THEN
    -- Create sequence for customer numbers
    CREATE SEQUENCE IF NOT EXISTS customer_number_seq START 1001;
    
    -- Add customer_number column
    ALTER TABLE customers ADD COLUMN customer_number integer UNIQUE DEFAULT nextval('customer_number_seq');
    
    -- Update existing customers to have customer numbers
    UPDATE customers SET customer_number = nextval('customer_number_seq') WHERE customer_number IS NULL;
    
    -- Make customer_number NOT NULL
    ALTER TABLE customers ALTER COLUMN customer_number SET NOT NULL;
  END IF;
END $$;

-- Remove unique constraint on id_number (not all customers have ID cards)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customers_id_number_key' AND table_name = 'customers'
  ) THEN
    ALTER TABLE customers DROP CONSTRAINT customers_id_number_key;
  END IF;
END $$;