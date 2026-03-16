/*
  # Add Performance Indexes for Accounting Module

  1. Performance Improvements
    - Add indexes on frequently queried columns across accounting tables
    - Optimize join operations and filtering queries
    - Improve sorting performance for date-based queries

  2. Indexes Created
    - accounting_invoices: company_id, invoice_type, status, issue_date
    - accounting_payments: invoice_id, payment_date, cesija_company_id
    - company_bank_accounts: company_id
    - company_credits: company_id
    - contracts: status
    - subcontractors: (name optimization via index)
    - office_suppliers: (name optimization via index)
    - customers: (name optimization via index)
*/

-- Accounting Invoices Indexes
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_company_id
  ON accounting_invoices(company_id);

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_invoice_type
  ON accounting_invoices(invoice_type);

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_status
  ON accounting_invoices(status);

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_issue_date
  ON accounting_invoices(issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_supplier_id
  ON accounting_invoices(supplier_id) WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_customer_id
  ON accounting_invoices(customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_office_supplier_id
  ON accounting_invoices(office_supplier_id) WHERE office_supplier_id IS NOT NULL;

-- Accounting Payments Indexes
CREATE INDEX IF NOT EXISTS idx_accounting_payments_invoice_id
  ON accounting_payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_accounting_payments_payment_date
  ON accounting_payments(payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_accounting_payments_cesija_company_id
  ON accounting_payments(cesija_company_id) WHERE cesija_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_payments_company_bank_account_id
  ON accounting_payments(company_bank_account_id) WHERE company_bank_account_id IS NOT NULL;

-- Company Bank Accounts Index
CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_company_id
  ON company_bank_accounts(company_id);

-- Company Credits Index
CREATE INDEX IF NOT EXISTS idx_company_credits_company_id
  ON company_credits(company_id);

-- Contracts Status Index
CREATE INDEX IF NOT EXISTS idx_contracts_status
  ON contracts(status);

CREATE INDEX IF NOT EXISTS idx_contracts_project_id
  ON contracts(project_id);

-- Subcontractors Name Index (for ordering)
CREATE INDEX IF NOT EXISTS idx_subcontractors_name
  ON subcontractors(name);

-- Office Suppliers Name Index (for ordering)
CREATE INDEX IF NOT EXISTS idx_office_suppliers_name
  ON office_suppliers(name);

-- Customers Name Index (for ordering)
CREATE INDEX IF NOT EXISTS idx_customers_name
  ON customers(name);

-- Sales Indexes
CREATE INDEX IF NOT EXISTS idx_sales_customer_id
  ON sales(customer_id);

CREATE INDEX IF NOT EXISTS idx_sales_apartment_id
  ON sales(apartment_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_company_status
  ON accounting_invoices(company_id, status);

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_company_type
  ON accounting_invoices(company_id, invoice_type);

CREATE INDEX IF NOT EXISTS idx_accounting_payments_cesija_flag
  ON accounting_payments(cesija_company_id, is_cesija)
  WHERE is_cesija = true;