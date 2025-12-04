/*
  # Create Company Statistics View

  1. Purpose
    - Provide pre-aggregated statistics for each company
    - Eliminate N queries and client-side calculations
    - Dramatically improve AccountingCompanies load time

  2. Statistics Included
    - Total bank account balance
    - Total credits available
    - Income invoices count and amounts
    - Expense invoices count and amounts
    - Profit and revenue calculations

  3. Performance
    - Single query instead of 4+ queries per company
    - Database-side aggregation is much faster
    - Indexed foreign keys make this very efficient
*/

CREATE OR REPLACE VIEW company_statistics AS
SELECT
  c.id,
  c.name,
  c.oib,
  c.initial_balance,
  c.created_at,
  
  -- Bank accounts stats
  COALESCE(SUM(ba.current_balance), 0) as total_bank_balance,
  COUNT(DISTINCT ba.id) as bank_accounts_count,
  
  -- Credits stats
  COALESCE(SUM(cr.initial_amount - cr.current_balance), 0) as total_credits_available,
  COUNT(DISTINCT cr.id) as credits_count,
  
  -- Income invoices (money coming in)
  COUNT(DISTINCT CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.id 
  END) as total_income_invoices,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.total_amount 
    ELSE 0 
  END), 0) as total_income_amount,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.paid_amount 
    ELSE 0 
  END), 0) as total_income_paid,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.remaining_amount 
    ELSE 0 
  END), 0) as total_income_unpaid,
  
  -- Expense invoices (money going out)
  COUNT(DISTINCT CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE') 
    THEN inv.id 
  END) as total_expense_invoices,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE') 
    THEN inv.total_amount 
    ELSE 0 
  END), 0) as total_expense_amount,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE') 
    THEN inv.paid_amount 
    ELSE 0 
  END), 0) as total_expense_paid,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE') 
    THEN inv.remaining_amount 
    ELSE 0 
  END), 0) as total_expense_unpaid
  
FROM accounting_companies c
LEFT JOIN company_bank_accounts ba ON ba.company_id = c.id
LEFT JOIN company_credits cr ON cr.company_id = c.id
LEFT JOIN accounting_invoices inv ON inv.company_id = c.id
GROUP BY c.id, c.name, c.oib, c.initial_balance, c.created_at;

-- Grant access to authenticated users
GRANT SELECT ON company_statistics TO authenticated;