/*
  # company_statistics: the final definition, after two branches changed it

  Two branches redefined this view in parallel:

  - fix/backlog-batch-2, 20261001100000: the view runs with the caller's rights
    (security_invoker), so RLS on invoices, bank accounts and credits applies to it (SEC-A11);
    and income/expense follow the cash-direction rule, with all four bank-type invoices and
    INCOMING_INVESTMENT left out as financing.
  - feat/user-guidance-phase-1, 20261005110000 and 20261005120000: INCOMING_INVESTMENT and credit
    fees are operating costs and count as expense; only credit principal is financing, reported
    in two new columns (DEFECT_BACKLOG CASH-7, decided 2026-10-05 with accounting).

  Applied one after the other they do not add up. CREATE OR REPLACE VIEW *replaces* a view's
  options, so the two later migrations, which carry no WITH clause, switch security_invoker back
  off; and on production and LandmarkDev they ran without the first one at all. This migration
  states the result once, so every database ends in the same place whatever it has applied:

    income              operating, money in    OUTGOING_SALES, OUTGOING_OFFICE, OUTGOING_SUPPLIER
    expense             operating, money out   INCOMING_SUPPLIER, INCOMING_OFFICE,
                                               INCOMING_INVESTMENT, INCOMING_BANK_EXPENSES
    financing received  OUTGOING_BANK          paid amount of credit drawdowns
    financing repaid    INCOMING_BANK          paid amount of repayments of principal
    security_invoker    on

  The lists are the four cells of src/utils/invoiceCashDirection.ts;
  invoiceCashDirection.test.ts reads this file and fails if they differ, or if security_invoker
  is missing. Columns are unchanged from 20261005120000, so nothing that reads the view breaks.

  With security_invoker on, a role that RLS does not let read invoices or bank accounts
  (Sales, Supervision, Investment) gets the company rows with zero figures — the Companies screen
  is Director and Accounting only, so this changes nothing they see.
*/

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
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text])) THEN inv.id
            ELSE NULL::uuid
        END) AS total_income_invoices,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text])) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_amount,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_paid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text])) THEN inv.remaining_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_unpaid,
    count(DISTINCT
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK_EXPENSES'::text])) THEN inv.id
            ELSE NULL::uuid
        END) AS total_expense_invoices,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK_EXPENSES'::text])) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_expense_amount,
    (COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK_EXPENSES'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) + COALESCE(cesija_stats.cesija_paid, (0)::numeric)) AS total_expense_paid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK_EXPENSES'::text])) THEN inv.remaining_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_expense_unpaid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_BANK'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_financing_received,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_BANK'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_financing_repaid
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
  GROUP BY c.id, c.name, c.oib, c.initial_balance, c.created_at, ba_stats.total_balance, ba_stats.accounts_count, cr_stats.available, cr_stats.credits_count, cesija_stats.cesija_paid;

ALTER VIEW public.company_statistics SET (security_invoker = on);
