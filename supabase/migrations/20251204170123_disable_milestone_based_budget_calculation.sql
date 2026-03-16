/*
  # Disable Milestone-Based Budget Calculation for Retail Contracts

  ## Problem
  The retail_contract_milestones trigger updates budget_realized based on milestone status='paid',
  which creates "ghost" payments that don't exist in accounting_invoices/accounting_payments.

  ## Solution
  1. Drop the milestone-based budget trigger
  2. Budget_realized should ONLY be updated from accounting_payments
  3. Recalculate all budget_realized values based on actual payments

  ## Changes
  - Drop trigger update_contract_budget_on_milestone
  - Drop function update_retail_contract_budget_realized
  - Recalculate budget_realized for all retail contracts from accounting_payments
*/

-- Drop the milestone-based trigger
DROP TRIGGER IF EXISTS update_contract_budget_on_milestone ON retail_contract_milestones;

-- Drop the milestone-based function
DROP FUNCTION IF EXISTS update_retail_contract_budget_realized() CASCADE;

-- Recalculate ALL retail contract budget_realized from actual accounting payments
UPDATE retail_contracts rc
SET budget_realized = COALESCE((
  SELECT SUM(ap.amount)
  FROM accounting_payments ap
  INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.retail_contract_id = rc.id
), 0),
updated_at = now();

-- Note: budget_realized will now ONLY be updated by the existing trigger
-- update_retail_contract_budget_realized_from_payments() which was created
-- in migration 20251204163732_update_retail_contract_budget_from_payments.sql
