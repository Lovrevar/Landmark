
/*
  # Fix Duplicate budget_realized Updates on retail_contracts

  ## Problem
  Two separate triggers were both updating `retail_contracts.budget_realized` during an invoice
  delete, causing double-writes and potential mismatches:

  1. `trigger_update_retail_contract_budget_on_invoice_delete` (BEFORE DELETE on accounting_invoices)
     calls `update_retail_contract_budget_on_invoice_delete()` — recalculates budget_realized
     excluding the deleted invoice.

  2. Payment-side triggers (`trigger_update_retail_contract_budget_on_payment_insert/update/delete`)
     on `accounting_payments` call `update_retail_contract_budget_realized_from_payments()` —
     recalculates budget_realized from all remaining payments.

  When an invoice is deleted (especially with cascading payment deletes), both paths fire in
  sequence at different points in the transaction, writing conflicting values to budget_realized.

  ## Fix
  Drop the redundant `trigger_update_retail_contract_budget_on_invoice_delete` trigger and its
  backing function. The three payment-side triggers already handle all scenarios correctly —
  they recalculate from scratch on every payment INSERT/UPDATE/DELETE and will naturally produce
  the correct result once the invoice (and its payments) are removed.

  ## Changes
  - Drop trigger: `trigger_update_retail_contract_budget_on_invoice_delete` on `accounting_invoices`
  - Drop function: `update_retail_contract_budget_on_invoice_delete()`
*/

DROP TRIGGER IF EXISTS trigger_update_retail_contract_budget_on_invoice_delete ON accounting_invoices;

DROP FUNCTION IF EXISTS update_retail_contract_budget_on_invoice_delete();
