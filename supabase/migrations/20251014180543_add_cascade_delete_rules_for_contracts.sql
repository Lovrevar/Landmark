/*
  # Add Cascade Delete Rules for Contracts and Wire Payments

  1. Changes
    - Drop existing foreign key constraints on contracts table
    - Recreate foreign key constraints with CASCADE DELETE on subcontractor deletion
    - Drop existing foreign key constraints on wire_payments table
    - Recreate foreign key constraints with CASCADE DELETE on contract and subcontractor deletion
    
  2. Purpose
    - When a subcontractor is deleted, all associated contracts are automatically deleted
    - When a contract is deleted, all associated wire payments are automatically deleted
    - Ensures data consistency and prevents orphaned records
    
  3. Security
    - No changes to RLS policies
    - Maintains existing security model
*/

-- Drop and recreate foreign key constraint on contracts.subcontractor_id with CASCADE DELETE
ALTER TABLE contracts 
DROP CONSTRAINT IF EXISTS contracts_subcontractor_id_fkey;

ALTER TABLE contracts 
ADD CONSTRAINT contracts_subcontractor_id_fkey 
FOREIGN KEY (subcontractor_id) 
REFERENCES subcontractors(id) 
ON DELETE CASCADE;

-- Drop and recreate foreign key constraint on wire_payments.contract_id with CASCADE DELETE
ALTER TABLE wire_payments 
DROP CONSTRAINT IF EXISTS wire_payments_contract_id_fkey;

ALTER TABLE wire_payments 
ADD CONSTRAINT wire_payments_contract_id_fkey 
FOREIGN KEY (contract_id) 
REFERENCES contracts(id) 
ON DELETE CASCADE;

-- Drop and recreate foreign key constraint on wire_payments.subcontractor_id with CASCADE DELETE
ALTER TABLE wire_payments 
DROP CONSTRAINT IF EXISTS wire_payments_subcontractor_id_fkey;

ALTER TABLE wire_payments 
ADD CONSTRAINT wire_payments_subcontractor_id_fkey 
FOREIGN KEY (subcontractor_id) 
REFERENCES subcontractors(id) 
ON DELETE CASCADE;
