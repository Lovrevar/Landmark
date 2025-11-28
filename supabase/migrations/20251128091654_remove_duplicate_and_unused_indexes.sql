/*
  # Remove Duplicate and Unused Indexes

  ## Performance & Storage Optimization
  
  Unused indexes waste storage and slow down INSERT/UPDATE operations.
  Duplicate indexes provide no benefit and should be removed.

  ## Changes
  
  ### Duplicate Indexes Removed:
  - idx_accounting_invoices_invoice_category (duplicate of idx_accounting_invoices_category)
  
  ### Unused Indexes Removed:
  These indexes are not being used by any queries and can be safely removed:
  
  1. **users**: idx_users_auth_user_id
  2. **accounting_companies**: idx_accounting_companies_oib
  3. **customers**: idx_customers_last_contact_date, idx_customers_status
  4. **funding_payments**: idx_funding_payments_investor, idx_funding_payments_bank
  5. **contracts**: idx_contracts_contract_number, idx_contracts_status, idx_contracts_end_date
  6. **subcontractors**: idx_subcontractors_financed_by_investor, idx_subcontractors_financed_by_bank
  7. **accounting_invoices**: Multiple unused category/relationship indexes
  8. **work_logs**: idx_work_logs_status
  9. **accounting_payments**: idx_accounting_payments_created_by

  Note: Core foreign key indexes and frequently queried columns are kept.
*/

-- Drop duplicate index
DROP INDEX IF EXISTS idx_accounting_invoices_invoice_category;

-- Drop unused indexes
DROP INDEX IF EXISTS idx_users_auth_user_id;
DROP INDEX IF EXISTS idx_accounting_companies_oib;
DROP INDEX IF EXISTS idx_customers_last_contact_date;
DROP INDEX IF EXISTS idx_customers_status;
DROP INDEX IF EXISTS idx_funding_payments_investor;
DROP INDEX IF EXISTS idx_funding_payments_bank;
DROP INDEX IF EXISTS idx_contracts_contract_number;
DROP INDEX IF EXISTS idx_contracts_status;
DROP INDEX IF EXISTS idx_contracts_end_date;
DROP INDEX IF EXISTS idx_subcontractors_financed_by_investor;
DROP INDEX IF EXISTS idx_subcontractors_financed_by_bank;
DROP INDEX IF EXISTS idx_accounting_invoices_investor_id;
DROP INDEX IF EXISTS idx_accounting_invoices_apartment_id;
DROP INDEX IF EXISTS idx_accounting_invoices_bank_credit_id;
DROP INDEX IF EXISTS idx_accounting_invoices_investment_id;
DROP INDEX IF EXISTS idx_accounting_invoices_bank_id;
DROP INDEX IF EXISTS idx_accounting_invoices_apartment_category;
DROP INDEX IF EXISTS idx_accounting_invoices_supplier;
DROP INDEX IF EXISTS idx_accounting_invoices_project;
DROP INDEX IF EXISTS idx_work_logs_status;
DROP INDEX IF EXISTS idx_accounting_payments_created_by;
