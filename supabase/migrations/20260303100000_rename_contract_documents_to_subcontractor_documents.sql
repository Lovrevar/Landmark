/*
  # Rename contract_documents to subcontractor_documents

  ## Changes
  - Rename table `contract_documents` → `subcontractor_documents`
  - Add mandatory `subcontractor_id` (FK → subcontractors.id, CASCADE)
  - Make `contract_id` optional (nullable)
  - Backfill `subcontractor_id` from existing contracts
  - Rename / recreate indexes and RLS policies

  ## Notes
  - Existing rows have their subcontractor_id backfilled via the contracts table
  - Storage bucket and file paths are unchanged; file_path values remain valid
*/

-- Step 1: Rename the table
ALTER TABLE contract_documents RENAME TO subcontractor_documents;

-- Step 2: Rename existing index
ALTER INDEX IF EXISTS idx_contract_documents_contract_id
  RENAME TO idx_subcontractor_documents_contract_id;

-- Step 3: Make contract_id nullable (was NOT NULL)
ALTER TABLE subcontractor_documents
  ALTER COLUMN contract_id DROP NOT NULL;

-- Step 4: Add subcontractor_id column (nullable first so backfill can run)
ALTER TABLE subcontractor_documents
  ADD COLUMN subcontractor_id uuid REFERENCES subcontractors(id) ON DELETE CASCADE;

-- Step 5: Backfill subcontractor_id from the contracts table
UPDATE subcontractor_documents sd
SET subcontractor_id = c.subcontractor_id
FROM contracts c
WHERE sd.contract_id = c.id;

-- Step 6: Enforce NOT NULL now that existing rows are populated
ALTER TABLE subcontractor_documents
  ALTER COLUMN subcontractor_id SET NOT NULL;

-- Step 7: Add index on the new FK
CREATE INDEX idx_subcontractor_documents_subcontractor_id
  ON subcontractor_documents(subcontractor_id);

-- Step 8: Drop old RLS policies (named after the old table/concept)
DROP POLICY IF EXISTS "Authenticated users can view contract documents"   ON subcontractor_documents;
DROP POLICY IF EXISTS "Authenticated users can upload contract documents"  ON subcontractor_documents;
DROP POLICY IF EXISTS "Authenticated users can delete contract documents"  ON subcontractor_documents;

-- Step 9: Recreate RLS policies with updated names
CREATE POLICY "Authenticated users can view subcontractor documents"
  ON subcontractor_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload subcontractor documents"
  ON subcontractor_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can delete subcontractor documents"
  ON subcontractor_documents FOR DELETE
  TO authenticated
  USING (true);
