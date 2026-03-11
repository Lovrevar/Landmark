/*
  # Fix Company Statistics to Include Cesija Payments

  ## Summary
  Updates the company_statistics view to properly include invoices paid via cesija (assignment).
  When Company A pays an invoice via cesija for Company B, the amount should be reflected as
  an expense for Company A.

  ## Changes
  1. **Updated company_statistics view:**
     - Now includes cesija payments in expense calculations
     - Adds expenses paid via cesija (where cesija_company_id = company.id)
     - Properly tracks total expenses including both direct invoices and cesija payments

  ## Details
  The view now:
  - Calculates direct expenses (invoices where company_id = company.id)
  - Adds cesija-paid expenses (payments where cesija_company_id = company.id)
  - Provides accurate total_expense_paid that includes both types
*/

-- Drop the existing view
DROP VIEW IF EXISTS company_statistics;

-- Recreate the view with cesija payment support
CREATE OR REPLACE VIEW company_statistics AS
SELECT 
  c.id,
  c.name,
  c.oib,
  c.initial_balance,
  c.created_at,
  
  -- Bank accounts summary
  COALESCE(ba_stats.total_balance, 0) AS total_bank_balance,
  COALESCE(ba_stats.accounts_count, 0) AS bank_accounts_count,
  
  -- Credits summary  
  COALESCE(cr_stats.available, 0) AS total_credits_available,
  COALESCE(cr_stats.credits_count, 0) AS credits_count,
  
  -- Income invoices (OUTGOING from company perspective)
  COUNT(DISTINCT CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.id 
  END) AS total_income_invoices,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.total_amount 
    ELSE 0 
  END), 0) AS total_income_amount,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.paid_amount 
    ELSE 0 
  END), 0) AS total_income_paid,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.remaining_amount 
    ELSE 0 
  END), 0) AS total_income_unpaid,
  
  -- Expense invoices (INCOMING from company perspective) 
  COUNT(DISTINCT CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE', 'INCOMING_BANK', 'OUTGOING_BANK') 
    THEN inv.id 
  END) AS total_expense_invoices,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE', 'INCOMING_BANK', 'OUTGOING_BANK') 
    THEN inv.total_amount 
    ELSE 0 
  END), 0) AS total_expense_amount,
  
  -- Expense paid includes both direct payments and cesija payments
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE', 'INCOMING_BANK', 'OUTGOING_BANK') 
    THEN inv.paid_amount 
    ELSE 0 
  END), 0) + COALESCE(cesija_stats.cesija_paid, 0) AS total_expense_paid,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE', 'INCOMING_BANK', 'OUTGOING_BANK') 
    THEN inv.remaining_amount 
    ELSE 0 
  END), 0) AS total_expense_unpaid

FROM accounting_companies c

-- Bank accounts aggregation
LEFT JOIN LATERAL (
  SELECT 
    SUM(current_balance) AS total_balance,
    COUNT(*) AS accounts_count
  FROM company_bank_accounts
  WHERE company_id = c.id
) ba_stats ON true

-- Credits aggregation
LEFT JOIN LATERAL (
  SELECT 
    SUM(amount - outstanding_balance) AS available,
    COUNT(*) AS credits_count
  FROM bank_credits
  WHERE company_id = c.id
) cr_stats ON true

-- Cesija payments aggregation (payments made by this company via cesija)
LEFT JOIN LATERAL (
  SELECT 
    COALESCE(SUM(ap.amount), 0) AS cesija_paid
  FROM accounting_payments ap
  WHERE ap.cesija_company_id = c.id
    AND ap.is_cesija = true
) cesija_stats ON true

-- Regular invoices
LEFT JOIN accounting_invoices inv ON inv.company_id = c.id

GROUP BY 
  c.id, 
  c.name, 
  c.oib, 
  c.initial_balance, 
  c.created_at, 
  ba_stats.total_balance, 
  ba_stats.accounts_count, 
  cr_stats.available, 
  cr_stats.credits_count,
  cesija_stats.cesija_paid;

-- Add comment
COMMENT ON VIEW company_statistics IS 'Company statistics including direct invoices and cesija payments';
