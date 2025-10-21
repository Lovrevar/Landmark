/*
  # Restructure Apartment Payments for Customer-Centric Tracking

  ## Summary
  This migration transforms the apartment_payments table from an employee-centric model 
  (tracking who created the payment) to a customer-centric model (tracking who is paying).
  
  ## Changes Made
  
  1. **Add New Columns to apartment_payments**
     - `customer_id` (uuid, required) - Links payment to the customer making the payment
     - `project_id` (uuid, required) - Links payment to the project
     - `sale_id` (uuid, optional) - Links payment to the specific sale transaction
     - `payment_type` (text) - Type of payment: 'down_payment', 'installment', 'final_payment', 'other'
     - `garage_id` (uuid, optional) - Links payment to garage if applicable
     - `storage_id` (uuid, optional) - Links payment to storage/repository if applicable
  
  2. **Add Foreign Key Constraints**
     - customer_id references customers(id) with CASCADE DELETE
     - project_id references projects(id) with CASCADE DELETE  
     - sale_id references sales(id) with CASCADE DELETE
     - garage_id references garages(id) with SET NULL
     - storage_id references repositories(id) with SET NULL
  
  3. **Add Indexes**
     - Index on customer_id for fast customer payment lookups
     - Index on project_id for project-based reporting
     - Index on sale_id for sale payment tracking
     - Index on payment_date for chronological queries
  
  4. **Add CHECK Constraint**
     - Ensure valid payment_type values
  
  ## Important Notes
  - This migration maintains backward compatibility by keeping apartment_id
  - Payments are now properly linked to customers, projects, and sales
  - Optional garage_id and storage_id allow tracking payments for additional property assets
  - The created_by column has already been removed in a previous migration
  - All existing RLS policies remain in effect
*/

-- Step 1: Add new columns to apartment_payments table
DO $$ 
BEGIN
  -- Add customer_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'apartment_payments' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE apartment_payments ADD COLUMN customer_id uuid;
  END IF;

  -- Add project_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'apartment_payments' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE apartment_payments ADD COLUMN project_id uuid;
  END IF;

  -- Add sale_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'apartment_payments' AND column_name = 'sale_id'
  ) THEN
    ALTER TABLE apartment_payments ADD COLUMN sale_id uuid;
  END IF;

  -- Add payment_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'apartment_payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE apartment_payments ADD COLUMN payment_type text DEFAULT 'installment';
  END IF;

  -- Add garage_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'apartment_payments' AND column_name = 'garage_id'
  ) THEN
    ALTER TABLE apartment_payments ADD COLUMN garage_id uuid;
  END IF;

  -- Add storage_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'apartment_payments' AND column_name = 'storage_id'
  ) THEN
    ALTER TABLE apartment_payments ADD COLUMN storage_id uuid;
  END IF;
END $$;

-- Step 2: Populate customer_id and project_id from existing sales and apartments data
-- This ensures existing payment records have proper relationships
UPDATE apartment_payments ap
SET 
  customer_id = s.customer_id,
  project_id = a.project_id,
  sale_id = s.id
FROM apartments a
LEFT JOIN sales s ON s.apartment_id = a.id
WHERE ap.apartment_id = a.id
  AND ap.customer_id IS NULL;

-- Step 3: Make customer_id and project_id NOT NULL after populating data
ALTER TABLE apartment_payments 
ALTER COLUMN customer_id SET NOT NULL;

ALTER TABLE apartment_payments 
ALTER COLUMN project_id SET NOT NULL;

-- Step 4: Add foreign key constraints
ALTER TABLE apartment_payments 
DROP CONSTRAINT IF EXISTS apartment_payments_customer_id_fkey;

ALTER TABLE apartment_payments 
ADD CONSTRAINT apartment_payments_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES customers(id) 
ON DELETE CASCADE;

ALTER TABLE apartment_payments 
DROP CONSTRAINT IF EXISTS apartment_payments_project_id_fkey;

ALTER TABLE apartment_payments 
ADD CONSTRAINT apartment_payments_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES projects(id) 
ON DELETE CASCADE;

ALTER TABLE apartment_payments 
DROP CONSTRAINT IF EXISTS apartment_payments_sale_id_fkey;

ALTER TABLE apartment_payments 
ADD CONSTRAINT apartment_payments_sale_id_fkey 
FOREIGN KEY (sale_id) 
REFERENCES sales(id) 
ON DELETE CASCADE;

ALTER TABLE apartment_payments 
DROP CONSTRAINT IF EXISTS apartment_payments_garage_id_fkey;

ALTER TABLE apartment_payments 
ADD CONSTRAINT apartment_payments_garage_id_fkey 
FOREIGN KEY (garage_id) 
REFERENCES garages(id) 
ON DELETE SET NULL;

ALTER TABLE apartment_payments 
DROP CONSTRAINT IF EXISTS apartment_payments_storage_id_fkey;

ALTER TABLE apartment_payments 
ADD CONSTRAINT apartment_payments_storage_id_fkey 
FOREIGN KEY (storage_id) 
REFERENCES repositories(id) 
ON DELETE SET NULL;

-- Step 5: Add CHECK constraint for payment_type
ALTER TABLE apartment_payments 
DROP CONSTRAINT IF EXISTS apartment_payments_payment_type_check;

ALTER TABLE apartment_payments 
ADD CONSTRAINT apartment_payments_payment_type_check 
CHECK (payment_type IN ('down_payment', 'installment', 'final_payment', 'other'));

-- Step 6: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_apartment_payments_customer_id 
ON apartment_payments(customer_id);

CREATE INDEX IF NOT EXISTS idx_apartment_payments_project_id 
ON apartment_payments(project_id);

CREATE INDEX IF NOT EXISTS idx_apartment_payments_sale_id 
ON apartment_payments(sale_id);

CREATE INDEX IF NOT EXISTS idx_apartment_payments_payment_date 
ON apartment_payments(payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_apartment_payments_garage_id 
ON apartment_payments(garage_id) WHERE garage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_apartment_payments_storage_id 
ON apartment_payments(storage_id) WHERE storage_id IS NOT NULL;

-- Step 7: Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_apartment_payments_customer_project 
ON apartment_payments(customer_id, project_id);

CREATE INDEX IF NOT EXISTS idx_apartment_payments_sale_payment_date 
ON apartment_payments(sale_id, payment_date DESC);
