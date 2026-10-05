-- =============================================================================
-- company_statistics: ULAZNI (INV) is an expense, not income (CASH-7)
-- =============================================================================
-- Decision, October 2026: an INCOMING_INVESTMENT invoice ("ULAZNI (INV)") is a bill
-- the company receives from a financier, and paying it is always money out.
--
-- This view was the one SQL object that said otherwise. It listed the type under
-- income, so the Companies cards showed a paid ULAZNI (INV) invoice as "income
-- paid" and added it to profit — on the same card as a bank balance that
-- recalc_company_bank_account_balance had just lowered by the same payment.
--
-- The only change is which list the type is in: out of the four income
-- expressions, into the four expense ones. Columns, joins and grouping are as in
-- the baseline, so CREATE OR REPLACE keeps the view's grants and dependants.
--
-- Deliberately not changed: OUTGOING_SUPPLIER and OUTGOING_BANK remain in the
-- expense list, and the bank types are counted as expenses. Those are a separate
-- open question (is this view revenue/expense or cash flow?) and were not part of
-- the decision.
--
-- At the time of writing production holds no INCOMING_INVESTMENT rows, so applying
-- this changes no figure there; it fixes how the type will be counted.
--
-- src/utils/invoiceCashDirection.ts states the same rule for the client, and its
-- test reads this file.
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
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text])) THEN inv.id
            ELSE NULL::uuid
        END) AS total_income_invoices,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text])) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_amount,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_paid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text])) THEN inv.remaining_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_unpaid,
    count(DISTINCT
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'OUTGOING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text, 'OUTGOING_BANK'::text])) THEN inv.id
            ELSE NULL::uuid
        END) AS total_expense_invoices,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'OUTGOING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text, 'OUTGOING_BANK'::text])) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_expense_amount,
    (COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'OUTGOING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text, 'OUTGOING_BANK'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) + COALESCE(cesija_stats.cesija_paid, (0)::numeric)) AS total_expense_paid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'OUTGOING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text, 'OUTGOING_BANK'::text])) THEN inv.remaining_amount
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
