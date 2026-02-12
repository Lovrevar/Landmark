/*
  # Add Disbursed to Account Fields to Project Investments

  ## Summary
  Adds support for tracking whether equity investment amounts are disbursed directly to company bank accounts.
  This mirrors the functionality available in bank credits.

  ## Changes Made
  1. New Columns
     - `disbursed_to_account` - Boolean flag indicating if investment is disbursed to a bank account
     - `disbursed_to_bank_account_id` - UUID reference to the bank account where funds are disbursed

  2. Foreign Keys
     - disbursed_to_bank_account_id references company_bank_accounts table

  3. Constraints
     - If disbursed_to_account is true, disbursed_to_bank_account_id must be set
     - If disbursed_to_account is false or null, disbursed_to_bank_account_id must be null

  ## Notes
  - When an investment is marked as disbursed to account, the bank account balance is automatically updated
  - This provides consistency with bank credit disbursement tracking
*/

-- Add new columns
ALTER TABLE project_investments
ADD COLUMN IF NOT EXISTS disbursed_to_account BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS disbursed_to_bank_account_id UUID;

-- Add foreign key constraint
ALTER TABLE project_investments
DROP CONSTRAINT IF EXISTS fk_investment_disbursed_bank_account;

ALTER TABLE project_investments
ADD CONSTRAINT fk_investment_disbursed_bank_account
FOREIGN KEY (disbursed_to_bank_account_id)
REFERENCES company_bank_accounts(id)
ON DELETE SET NULL;

-- Add check constraint to ensure consistency
ALTER TABLE project_investments
DROP CONSTRAINT IF EXISTS check_disbursed_account_consistency;

ALTER TABLE project_investments
ADD CONSTRAINT check_disbursed_account_consistency
CHECK (
  (disbursed_to_account = TRUE AND disbursed_to_bank_account_id IS NOT NULL) OR
  (disbursed_to_account = FALSE OR disbursed_to_account IS NULL)
);

-- Create index for foreign key lookup
CREATE INDEX IF NOT EXISTS idx_investments_disbursed_bank_account
ON project_investments(disbursed_to_bank_account_id);

-- Create trigger function to update bank account balance when investment is disbursed
CREATE OR REPLACE FUNCTION update_bank_balance_for_investment()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: If disbursed to account, increase bank balance
  IF TG_OP = 'INSERT' AND NEW.disbursed_to_account = TRUE AND NEW.disbursed_to_bank_account_id IS NOT NULL THEN
    UPDATE company_bank_accounts
    SET balance = balance + NEW.amount
    WHERE id = NEW.disbursed_to_bank_account_id;
  END IF;

  -- On UPDATE: Handle changes in disbursement status or amount
  IF TG_OP = 'UPDATE' THEN
    -- If disbursement status changed from false to true
    IF (OLD.disbursed_to_account = FALSE OR OLD.disbursed_to_account IS NULL) AND NEW.disbursed_to_account = TRUE THEN
      UPDATE company_bank_accounts
      SET balance = balance + NEW.amount
      WHERE id = NEW.disbursed_to_bank_account_id;
    END IF;

    -- If disbursement status changed from true to false
    IF OLD.disbursed_to_account = TRUE AND (NEW.disbursed_to_account = FALSE OR NEW.disbursed_to_account IS NULL) THEN
      UPDATE company_bank_accounts
      SET balance = balance - OLD.amount
      WHERE id = OLD.disbursed_to_bank_account_id;
    END IF;

    -- If still disbursed but amount changed
    IF OLD.disbursed_to_account = TRUE AND NEW.disbursed_to_account = TRUE AND OLD.amount != NEW.amount THEN
      UPDATE company_bank_accounts
      SET balance = balance - OLD.amount + NEW.amount
      WHERE id = NEW.disbursed_to_bank_account_id;
    END IF;

    -- If still disbursed but bank account changed
    IF OLD.disbursed_to_account = TRUE AND NEW.disbursed_to_account = TRUE 
       AND OLD.disbursed_to_bank_account_id != NEW.disbursed_to_bank_account_id THEN
      -- Decrease old account
      UPDATE company_bank_accounts
      SET balance = balance - OLD.amount
      WHERE id = OLD.disbursed_to_bank_account_id;
      
      -- Increase new account
      UPDATE company_bank_accounts
      SET balance = balance + NEW.amount
      WHERE id = NEW.disbursed_to_bank_account_id;
    END IF;
  END IF;

  -- On DELETE: If was disbursed, decrease bank balance
  IF TG_OP = 'DELETE' AND OLD.disbursed_to_account = TRUE AND OLD.disbursed_to_bank_account_id IS NOT NULL THEN
    UPDATE company_bank_accounts
    SET balance = balance - OLD.amount
    WHERE id = OLD.disbursed_to_bank_account_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS update_bank_balance_for_investment_trigger ON project_investments;

CREATE TRIGGER update_bank_balance_for_investment_trigger
AFTER INSERT OR UPDATE OR DELETE ON project_investments
FOR EACH ROW
EXECUTE FUNCTION update_bank_balance_for_investment();
