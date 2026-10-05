-- =============================================================================
-- company_statistics: income and expense are operating only; financing on its own (CASH-7)
-- =============================================================================
-- 20261005110000 moved ULAZNI (INV) from income to expense. This migration settles
-- the bank types, which the view counted as expenses — including OUTGOING_BANK, a
-- credit drawdown, which is money *in*. On the Companies cards a €600k drawdown
-- raised "expenses paid" and lowered "Dobit/Gubitak" by €600k while the same card's
-- bank balance rose by €600k.
--
-- Decision (October 2026): financing is neither income nor expense. The view's
-- lists now follow both dimensions of src/utils/invoiceCashDirection.ts:
--
--   income   = operating, money in    OUTGOING_SALES, OUTGOING_OFFICE, OUTGOING_SUPPLIER
--   expense  = operating, money out   INCOMING_SUPPLIER, INCOMING_OFFICE, INCOMING_INVESTMENT
--   financing received (new column)   OUTGOING_BANK                    — paid amount
--   financing repaid   (new column)   INCOMING_BANK, INCOMING_BANK_EXPENSES — paid amount
--
-- "Promet" and "Dobit/Gubitak" on the Companies screen keep their meaning: turnover
-- and result from operations. Credit drawdowns, repayments and credit fees leave
-- both and are shown on a separate line.
--
-- total_financing_repaid includes credit fees as well as repayments of principal.
-- Whether credit fees should instead count as a cost in "Dobit/Gubitak" is being
-- confirmed with accounting (docs/ACCOUNTING_REVIEW_CASH7.md); if so, only the two
-- lists below change.
--
-- The two new columns are appended, and nothing else about the view changes, so
-- CREATE OR REPLACE keeps its grants and dependants. Produces the same final view
-- with or without 20261005110000, but they are meant to run in order.
--
-- WHAT MOVES IN PRODUCTION (measured read-only on 2026-10-05; three of 14
-- companies have bank-type invoices, 55 in all):
--
--   all companies      expense invoiced  17.180.426,61 → 11.979.079,35
--                      expense paid       8.756.047,84 →  3.966.188,43
--                      expense unpaid     8.582.696,77 →  8.171.208,92
--                      income (all four)  unchanged
--                      financing received            — →  4.522.708,80
--                      financing repaid              — →    267.150,61
--
-- src/utils/invoiceCashDirection.test.ts reads this file and fails if any list
-- differs from the client map's direction and category.
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
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text])) THEN inv.id
            ELSE NULL::uuid
        END) AS total_expense_invoices,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text])) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_expense_amount,
    (COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) + COALESCE(cesija_stats.cesija_paid, (0)::numeric)) AS total_expense_paid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text])) THEN inv.remaining_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_expense_unpaid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_BANK'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_financing_received,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text])) THEN inv.paid_amount
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
