-- =============================================================================
-- company_statistics follows the cash-direction map for every invoice type (CASH-7)
-- =============================================================================
-- 20261005110000 moved ULAZNI (INV) from income to expense. Two types were still
-- on the wrong side of this view:
--
--   OUTGOING_SUPPLIER  an invoice the company issued to a supplier  — money in
--   OUTGOING_BANK      a credit drawdown                            — money in
--
-- Both were listed under expense. On the Companies cards a €600k drawdown therefore
-- raised "expenses paid" and lowered profit by €600k, while the same card's bank
-- balance rose by €600k.
--
-- After this migration the view's two lists are exactly the two sides of
-- src/utils/invoiceCashDirection.ts:
--
--   income  = every OUTGOING_* type  (OUTGOING_SALES, OUTGOING_OFFICE,
--                                     OUTGOING_SUPPLIER, OUTGOING_BANK)
--   expense = every INCOMING_* type  (INCOMING_SUPPLIER, INCOMING_OFFICE,
--             INCOMING_INVESTMENT, INCOMING_BANK, INCOMING_BANK_EXPENSES)
--
-- Columns, joins and grouping are unchanged, so CREATE OR REPLACE keeps the view's
-- grants and dependants. Safe to apply without 20261005110000 (it produces the same
-- final view), but they are meant to run in order.
--
-- WHAT MOVES IN PRODUCTION (measured read-only on 2026-10-05; OUTGOING_SUPPLIER has
-- no rows there, so all of it is the 14 OUTGOING_BANK drawdowns, €4.867.708,80
-- invoiced, €4.522.708,80 paid, €345.000,00 unpaid, across three companies):
--
--   all companies          income invoiced      127.813,76 →  4.995.522,56
--                          income paid          125.000,00 →  4.647.708,80
--                          expense invoiced  17.180.426,61 → 12.312.717,81
--                          expense paid       8.756.047,84 →  4.233.339,04
--
-- Read this before applying: the Companies screen labels these columns "Promet"
-- and "Dobit/Gubitak". After this migration they are cash in and net cash — a
-- drawdown is money received, not revenue earned. docs/DEPLOY_GUIDANCE_PHASE_1.md
-- says what to tell users.
--
-- src/utils/invoiceCashDirection.test.ts reads this file and fails if the lists
-- and the client map differ.
-- =============================================================================

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
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text, 'OUTGOING_BANK'::text])) THEN inv.id
            ELSE NULL::uuid
        END) AS total_income_invoices,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text, 'OUTGOING_BANK'::text])) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_amount,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text, 'OUTGOING_BANK'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_paid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_SUPPLIER'::text, 'OUTGOING_BANK'::text])) THEN inv.remaining_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_unpaid,
    count(DISTINCT
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text])) THEN inv.id
            ELSE NULL::uuid
        END) AS total_expense_invoices,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text])) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_expense_amount,
    (COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) + COALESCE(cesija_stats.cesija_paid, (0)::numeric)) AS total_expense_paid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text])) THEN inv.remaining_amount
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
  GROUP BY c.id, c.name, c.oib, c.initial_balance, c.created_at, ba_stats.total_balance, ba_stats.accounts_count, cr_stats.available, cr_stats.credits_count, cesija_stats.cesija_paid;
