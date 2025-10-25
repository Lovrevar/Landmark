/*
  # Add Financing Tracking to Subcontractors and Wire Payments

  ## Overview
  This migration adds comprehensive financing tracking capabilities to subcontractor contracts and wire payments.
  It allows tracking which bank or investor is financing each subcontractor contract, and which entity makes each payment.

  ## Changes

  ### 1. Subcontractors Table - Financing Information
    - Add `financed_by_type` column (text) - indicates whether financing is from 'investor' or 'bank'
    - Add `financed_by_investor_id` column (uuid) - foreign key to investors table
    - Add `financed_by_bank_id` column (uuid) - foreign key to banks table
    
  ### 2. Wire Payments Table - Payment Source Tracking
    - Add `paid_by_type` column (text) - indicates whether payment was made by 'investor' or 'bank'
    - Add `paid_by_investor_id` column (uuid) - foreign key to investors table
    - Add `paid_by_bank_id` column (uuid) - foreign key to banks table
    - Add `milestone_id` column (uuid) - foreign key to subcontractor_milestones table (already exists)

  ### 3. Foreign Key Constraints
    - Add foreign key from subcontractors.financed_by_investor_id to investors.id
    - Add foreign key from subcontractors.financed_by_bank_id to banks.id
    - Add foreign key from wire_payments.paid_by_investor_id to investors.id
    - Add foreign key from wire_payments.paid_by_bank_id to banks.id

  ### 4. Indexes
    - Create index on subcontractors(financed_by_investor_id)
    - Create index on subcontractors(financed_by_bank_id)
    - Create index on wire_payments(paid_by_investor_id)
    - Create index on wire_payments(paid_by_bank_id)

  ### 5. Security
    - RLS policies are inherited from parent tables (authenticated users have full access)

  ## Business Logic
  - When creating a subcontractor contract, optionally select a funding source (investor or bank) that provides funding to the project
  - When recording a wire payment, the system defaults to the contract's funding source but allows selecting any project funder
  - Both financing tracking and payment source tracking are optional to allow flexibility
  - Only one type of funder can be selected at a time (either investor OR bank, not both)

  ## Important Notes
  - All new columns are nullable to support optional financing tracking
  - Existing records will have NULL values for financing fields
  - Check constraints ensure only one funder type is specified at a time
*/

-- Add financing tracking columns to subcontractors table
DO $$
BEGIN
  -- Add financed_by_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subcontractors' AND column_name = 'financed_by_type'
  ) THEN
    ALTER TABLE subcontractors 
    ADD COLUMN financed_by_type TEXT CHECK (financed_by_type IN ('investor', 'bank'));
  END IF;

  -- Add financed_by_investor_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subcontractors' AND column_name = 'financed_by_investor_id'
  ) THEN
    ALTER TABLE subcontractors 
    ADD COLUMN financed_by_investor_id UUID REFERENCES investors(id) ON DELETE SET NULL;
  END IF;

  -- Add financed_by_bank_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subcontractors' AND column_name = 'financed_by_bank_id'
  ) THEN
    ALTER TABLE subcontractors 
    ADD COLUMN financed_by_bank_id UUID REFERENCES banks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add payment source tracking columns to wire_payments table
DO $$
BEGIN
  -- Add paid_by_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wire_payments' AND column_name = 'paid_by_type'
  ) THEN
    ALTER TABLE wire_payments 
    ADD COLUMN paid_by_type TEXT CHECK (paid_by_type IN ('investor', 'bank'));
  END IF;

  -- Add paid_by_investor_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wire_payments' AND column_name = 'paid_by_investor_id'
  ) THEN
    ALTER TABLE wire_payments 
    ADD COLUMN paid_by_investor_id UUID REFERENCES investors(id) ON DELETE SET NULL;
  END IF;

  -- Add paid_by_bank_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wire_payments' AND column_name = 'paid_by_bank_id'
  ) THEN
    ALTER TABLE wire_payments 
    ADD COLUMN paid_by_bank_id UUID REFERENCES banks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_subcontractors_financed_by_investor 
  ON subcontractors(financed_by_investor_id) 
  WHERE financed_by_investor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subcontractors_financed_by_bank 
  ON subcontractors(financed_by_bank_id) 
  WHERE financed_by_bank_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wire_payments_paid_by_investor 
  ON wire_payments(paid_by_investor_id) 
  WHERE paid_by_investor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wire_payments_paid_by_bank 
  ON wire_payments(paid_by_bank_id) 
  WHERE paid_by_bank_id IS NOT NULL;

-- Add check constraint to ensure only one funder type is specified for subcontractors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subcontractors_single_funder_check'
  ) THEN
    ALTER TABLE subcontractors 
    ADD CONSTRAINT subcontractors_single_funder_check 
    CHECK (
      (financed_by_investor_id IS NULL AND financed_by_bank_id IS NULL) OR
      (financed_by_investor_id IS NOT NULL AND financed_by_bank_id IS NULL) OR
      (financed_by_investor_id IS NULL AND financed_by_bank_id IS NOT NULL)
    );
  END IF;
END $$;

-- Add check constraint to ensure only one payer type is specified for wire payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'wire_payments_single_payer_check'
  ) THEN
    ALTER TABLE wire_payments 
    ADD CONSTRAINT wire_payments_single_payer_check 
    CHECK (
      (paid_by_investor_id IS NULL AND paid_by_bank_id IS NULL) OR
      (paid_by_investor_id IS NOT NULL AND paid_by_bank_id IS NULL) OR
      (paid_by_investor_id IS NULL AND paid_by_bank_id IS NOT NULL)
    );
  END IF;
END $$;

-- Add check constraint to ensure financed_by_type matches the ID columns for subcontractors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subcontractors_funder_type_consistency_check'
  ) THEN
    ALTER TABLE subcontractors 
    ADD CONSTRAINT subcontractors_funder_type_consistency_check 
    CHECK (
      (financed_by_type IS NULL AND financed_by_investor_id IS NULL AND financed_by_bank_id IS NULL) OR
      (financed_by_type = 'investor' AND financed_by_investor_id IS NOT NULL AND financed_by_bank_id IS NULL) OR
      (financed_by_type = 'bank' AND financed_by_bank_id IS NOT NULL AND financed_by_investor_id IS NULL)
    );
  END IF;
END $$;

-- Add check constraint to ensure paid_by_type matches the ID columns for wire payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'wire_payments_payer_type_consistency_check'
  ) THEN
    ALTER TABLE wire_payments 
    ADD CONSTRAINT wire_payments_payer_type_consistency_check 
    CHECK (
      (paid_by_type IS NULL AND paid_by_investor_id IS NULL AND paid_by_bank_id IS NULL) OR
      (paid_by_type = 'investor' AND paid_by_investor_id IS NOT NULL AND paid_by_bank_id IS NULL) OR
      (paid_by_type = 'bank' AND paid_by_bank_id IS NOT NULL AND paid_by_investor_id IS NULL)
    );
  END IF;
END $$;