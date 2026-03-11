/*
  # Fix company_statistics view: use used_amount for available credit calculation

  ## Problem
  The company_statistics view was calculating available credit as:
    amount - outstanding_balance

  This is incorrect because outstanding_balance = used_amount - repaid_amount.
  When a credit is fully drawn and a repayment is made, outstanding_balance decreases,
  making it appear as if credit capacity has been freed up again — but it hasn't.
  The repaid amount is already reflected in the bank account balance, causing double-counting.

  ## Fix
  Use amount - used_amount to calculate available credit, which correctly represents
  how much of the credit line has NOT yet been drawn. This matches the logic used
  throughout the rest of the codebase (CompanyCredits.tsx, AllocationRow.tsx).

  ## Impact
  - Trenutno stanje on the Accounting Companies page will no longer be inflated by repaid amounts
  - Available credit (Dostupno) correctly shows 0 when the full credit limit has been drawn
*/

CREATE OR REPLACE VIEW company_statistics AS
SELECT
  c.id,
  c.name,
  c.oib,
  c.initial_balance,
  c.created_at,
  COALESCE(ba_stats.total_balance, 0) AS total_bank_balance,
  COALESCE(ba_stats.accounts_count, 0) AS bank_accounts_count,
  COALESCE(cr_stats.available, 0) AS total_credits_available,
  COALESCE(cr_stats.credits_count, 0) AS credits_count,
  COUNT(DISTINCT CASE WHEN inv.invoice_type = ANY(ARRAY['INCOMING_INVESTMENT','OUTGOING_SALES','OUTGOING_OFFICE']) THEN inv.id END) AS total_income_invoices,
  COALESCE(SUM(CASE WHEN inv.invoice_type = ANY(ARRAY['INCOMING_INVESTMENT','OUTGOING_SALES','OUTGOING_OFFICE']) THEN inv.total_amount ELSE 0 END), 0) AS total_income_amount,
  COALESCE(SUM(CASE WHEN inv.invoice_type = ANY(ARRAY['INCOMING_INVESTMENT','OUTGOING_SALES','OUTGOING_OFFICE']) THEN inv.paid_amount ELSE 0 END), 0) AS total_income_paid,
  COALESCE(SUM(CASE WHEN inv.invoice_type = ANY(ARRAY['INCOMING_INVESTMENT','OUTGOING_SALES','OUTGOING_OFFICE']) THEN inv.remaining_amount ELSE 0 END), 0) AS total_income_unpaid,
  COUNT(DISTINCT CASE WHEN inv.invoice_type = ANY(ARRAY['INCOMING_SUPPLIER','OUTGOING_SUPPLIER','INCOMING_OFFICE','INCOMING_BANK','OUTGOING_BANK']) THEN inv.id END) AS total_expense_invoices,
  COALESCE(SUM(CASE WHEN inv.invoice_type = ANY(ARRAY['INCOMING_SUPPLIER','OUTGOING_SUPPLIER','INCOMING_OFFICE','INCOMING_BANK','OUTGOING_BANK']) THEN inv.total_amount ELSE 0 END), 0) AS total_expense_amount,
  (COALESCE(SUM(CASE WHEN inv.invoice_type = ANY(ARRAY['INCOMING_SUPPLIER','OUTGOING_SUPPLIER','INCOMING_OFFICE','INCOMING_BANK','OUTGOING_BANK']) THEN inv.paid_amount ELSE 0 END), 0) + COALESCE(cesija_stats.cesija_paid, 0)) AS total_expense_paid,
  COALESCE(SUM(CASE WHEN inv.invoice_type = ANY(ARRAY['INCOMING_SUPPLIER','OUTGOING_SUPPLIER','INCOMING_OFFICE','INCOMING_BANK','OUTGOING_BANK']) THEN inv.remaining_amount ELSE 0 END), 0) AS total_expense_unpaid
FROM accounting_companies c
LEFT JOIN LATERAL (
  SELECT SUM(current_balance) AS total_balance, COUNT(*) AS accounts_count
  FROM company_bank_accounts
  WHERE company_id = c.id
) ba_stats ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount - used_amount) AS available, COUNT(*) AS credits_count
  FROM bank_credits
  WHERE company_id = c.id
) cr_stats ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(ap.amount), 0) AS cesija_paid
  FROM accounting_payments ap
  WHERE ap.cesija_company_id = c.id AND ap.is_cesija = true
) cesija_stats ON true
LEFT JOIN accounting_invoices inv ON inv.company_id = c.id
GROUP BY c.id, c.name, c.oib, c.initial_balance, c.created_at, ba_stats.total_balance, ba_stats.accounts_count, cr_stats.available, cr_stats.credits_count, cesija_stats.cesija_paid;
