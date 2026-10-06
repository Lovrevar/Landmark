/*
  # company_statistics: RLS applies, and one income/expense rule

  DEFECT_BACKLOG CASH-7 (decided 2026-10-01) and SEC-A11.

  1. The view now runs with the caller's rights (security_invoker)
     It was a plain view, which Postgres runs as its owner, so RLS on accounting_invoices,
     company_bank_accounts and bank_credits did not apply: any role that could select from the view
     saw every company's bank balances and income/expense totals. With security_invoker the
     underlying policies apply — Director and Accounting see everything, other roles see the
     companies (names and OIBs are public reference data) with zero figures.

  2. Income and expense follow the cash-direction rule
     - Income  = invoices the company issued: OUTGOING_SALES, OUTGOING_OFFICE, OUTGOING_SUPPLIER.
     - Expense = bills the company pays: INCOMING_SUPPLIER, INCOMING_OFFICE.
     - Left out as financing (bank-credit invoices): INCOMING_INVESTMENT, INCOMING_BANK,
       INCOMING_BANK_EXPENSES, OUTGOING_BANK.
     Before: INCOMING_INVESTMENT counted as income, OUTGOING_SUPPLIER and OUTGOING_BANK (an invoice
     we issued, a credit drawdown) as expense. Cesija paid by the company for others still adds to
     total_expense_paid.

  Column names, types and order are unchanged, so CREATE OR REPLACE keeps every reader working.
*/

-- Guard added 2026-10-06 when this branch met feat/user-guidance-phase-1. Production and
-- LandmarkDev had already received 20261005110000 and 20261005120000, which give this view two
-- more columns (total_financing_received, total_financing_repaid). CREATE OR REPLACE VIEW cannot
-- drop columns, so on those two databases this statement would fail and block every later
-- migration. Where the newer view is already in place it is left alone; 20261006100000 then sets
-- the final definition everywhere. On a database built from migrations in order, the guard is
-- false and this runs exactly as written.
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'company_statistics'
      AND column_name = 'total_financing_received'
  ) THEN
    RAISE NOTICE 'company_statistics already has the financing columns; leaving its definition to 20261006100000';
    RETURN;
  END IF;

  EXECUTE $view$
CREATE OR REPLACE VIEW public.company_statistics AS
 SELECT c.id,
    c.name,
    c.oib,
    c.initial_balance,
    c.created_at,
    COALESCE(ba_stats.total_balance, (0)::numeric) AS total_bank_balance,
    COALESCE(ba_stats.accounts_count, (0)::bigint) AS bank_accounts_count,
    COALESCE(cr_stats.available, (0)::numeric) AS total_credits_available,
    COALESCE(cr_stats.credits_count, (0)::bigint) AS credits_count,
    count(DISTINCT
        CASE
            WHEN inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text]) THEN inv.id
            ELSE NULL::uuid
        END) AS total_income_invoices,
    COALESCE(sum(
        CASE
            WHEN inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text]) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_amount,
    COALESCE(sum(
        CASE
            WHEN inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text]) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_paid,
    COALESCE(sum(
        CASE
            WHEN inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text]) THEN inv.remaining_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_unpaid,
    count(DISTINCT
        CASE
            WHEN inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text]) THEN inv.id
            ELSE NULL::uuid
        END) AS total_expense_invoices,
    COALESCE(sum(
        CASE
            WHEN inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text]) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_expense_amount,
    (COALESCE(sum(
        CASE
            WHEN inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text]) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) + COALESCE(cesija_stats.cesija_paid, (0)::numeric)) AS total_expense_paid,
    COALESCE(sum(
        CASE
            WHEN inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text]) THEN inv.remaining_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_expense_unpaid
   FROM ((((public.accounting_companies c
     LEFT JOIN LATERAL ( SELECT sum(company_bank_accounts.current_balance) AS total_balance,
            count(*) AS accounts_count
           FROM public.company_bank_accounts
          WHERE (company_bank_accounts.company_id = c.id)) ba_stats ON (true))
     LEFT JOIN LATERAL ( SELECT sum((bank_credits.amount - bank_credits.used_amount)) AS available,
            count(*) AS credits_count
           FROM public.bank_credits
          WHERE (bank_credits.company_id = c.id)) cr_stats ON (true))
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(ap.amount), (0)::numeric) AS cesija_paid
           FROM public.accounting_payments ap
          WHERE ((ap.cesija_company_id = c.id) AND (ap.is_cesija = true))) cesija_stats ON (true))
     LEFT JOIN public.accounting_invoices inv ON ((inv.company_id = c.id)))
  GROUP BY c.id, c.name, c.oib, c.initial_balance, c.created_at, ba_stats.total_balance, ba_stats.accounts_count, cr_stats.available, cr_stats.credits_count, cesija_stats.cesija_paid
  $view$;
END
$guard$;

ALTER VIEW public.company_statistics SET (security_invoker = on);
