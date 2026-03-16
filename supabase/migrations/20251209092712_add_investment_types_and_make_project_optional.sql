/*
  # Proširenje tipova investicija i fleksibilnost projekta

  ## Izmene

  1. **Proširenje investment_type enum-a**
     - Dodaje "Operation Cost Loan" - kredit za operativne troškove
     - Dodaje "Refinancing Loan" - kredit za refinanciranje postojećih obaveza
     - Zadržava postojeće tipove: equity, loan, grant, bond

  2. **Projekat nije obavezan**
     - project_id postaje nullable u project_investments tabeli
     - Omogućava investicije koje nisu vezane za konkretan projekat
     - Koristi se za kredite za refinanciranje ili operativne troškove kompanije

  ## Razlog za promene

  Neki investitori mogu dati sredstva koja nisu vezana za specifičan projekat:
  - Refinanciranje postojećih kredita
  - Operativni troškovi kompanije
  - Ostali slučajevi gde investicija nije direktno vezana za projekat
*/

-- Drop old check constraint on investment_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'project_investments' 
    AND constraint_name LIKE '%investment_type%check%'
  ) THEN
    ALTER TABLE project_investments DROP CONSTRAINT IF EXISTS project_investments_investment_type_check;
  END IF;
END $$;

-- Add new check constraint with additional investment types
ALTER TABLE project_investments 
  DROP CONSTRAINT IF EXISTS project_investments_investment_type_check;

ALTER TABLE project_investments 
  ADD CONSTRAINT project_investments_investment_type_check 
  CHECK (investment_type = ANY (ARRAY[
    'equity'::text, 
    'loan'::text, 
    'grant'::text, 
    'bond'::text,
    'Operation Cost Loan'::text,
    'Refinancing Loan'::text
  ]));

-- Make project_id nullable
ALTER TABLE project_investments 
  ALTER COLUMN project_id DROP NOT NULL;

-- Add a helpful comment
COMMENT ON COLUMN project_investments.project_id IS 
  'Project reference - nullable because some investments (refinancing, operation costs) are not tied to specific projects';

COMMENT ON COLUMN project_investments.investment_type IS 
  'Type of investment: equity, loan, grant, bond, Operation Cost Loan (operativni troškovi), Refinancing Loan (refinanciranje kredita)';
