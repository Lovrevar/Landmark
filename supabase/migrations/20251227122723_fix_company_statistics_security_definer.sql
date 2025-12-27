/*
  # Fix Company Statistics View Security Property
  
  1. Problem
    - View is defined with SECURITY DEFINER property which Supabase warns against
    - SECURITY DEFINER can be a security risk
  
  2. Solution
    - Recreate view with SECURITY INVOKER (uses current user's permissions)
    - This is safer and follows Supabase best practices
  
  3. Changes
    - Drop existing view
    - Recreate with identical definition but using SECURITY INVOKER
*/

DROP VIEW IF EXISTS company_statistics;

CREATE VIEW company_statistics
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.name,
  c.oib,
  c.initial_balance,
  c.created_at,
  
  -- Bank accounts stats (LATERAL subquery prevents duplication)
  COALESCE(ba_stats.total_balance, 0) as total_bank_balance,
  COALESCE(ba_stats.accounts_count, 0) as bank_accounts_count,
  
  -- Credits stats (LATERAL subquery prevents duplication)
  COALESCE(cr_stats.available, 0) as total_credits_available,
  COALESCE(cr_stats.credits_count, 0) as credits_count,
  
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
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE', 'INCOMING_BANK', 'OUTGOING_BANK') 
    THEN inv.id 
  END) as total_expense_invoices,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE', 'INCOMING_BANK', 'OUTGOING_BANK') 
    THEN inv.total_amount 
    ELSE 0 
  END), 0) as total_expense_amount,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE', 'INCOMING_BANK', 'OUTGOING_BANK') 
    THEN inv.paid_amount 
    ELSE 0 
  END), 0) as total_expense_paid,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE', 'INCOMING_BANK', 'OUTGOING_BANK') 
    THEN inv.remaining_amount 
    ELSE 0 
  END), 0) as total_expense_unpaid
  
FROM accounting_companies c

-- Subquery for bank accounts (prevents duplication)
LEFT JOIN LATERAL (
  SELECT 
    SUM(current_balance) as total_balance,
    COUNT(*) as accounts_count
  FROM company_bank_accounts
  WHERE company_id = c.id
) ba_stats ON true

-- Subquery for credits (prevents duplication)
LEFT JOIN LATERAL (
  SELECT 
    SUM(amount - outstanding_balance) as available,
    COUNT(*) as credits_count
  FROM bank_credits
  WHERE company_id = c.id
) cr_stats ON true

-- Regular LEFT JOIN for invoices (main aggregation)
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
  cr_stats.credits_count;

-- Grant access to authenticated users
GRANT SELECT ON company_statistics TO authenticated;