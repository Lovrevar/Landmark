-- =============================================================================
-- C1 — Tighten RLS on cashflow-sensitive tables
-- =============================================================================
-- Before this migration, five tables (accounting_payments, accounting_companies,
-- bank_credits, company_loans, company_bank_accounts) had blanket `USING (true)`
-- policies. Any authenticated user — Sales, Supervision, Investment, Retail —
-- could read every row by typing one supabase.from(...) call into the browser
-- console. The client-side cashflow "password gate" did not enter the picture.
--
-- This migration replaces those policies with role-based ones, matching the
-- pattern already proven on `accounting_invoices` (joins public.users via
-- auth.uid(), checks role IN (...)).
--
-- Sales features that legitimately touched accounting_invoices and
-- accounting_payments (apartment payment history, sales reports) are preserved
-- by adding new scoped SELECT policies, NOT by leaving the tables open.
--
-- Rollback: see corresponding *_rollback.sql in /docs/runbooks if needed —
-- the previous policies can be restored by re-issuing the USING (true) CREATE
-- POLICY statements from the baseline schema.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- accounting_payments
-- -----------------------------------------------------------------------------
-- Drop the four "Authenticated users can ..." policies. Preserve the existing
-- "Retail can view payments for retail invoices" — it's already scoped.

DROP POLICY IF EXISTS "Authenticated users can view all payments" ON public.accounting_payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments"   ON public.accounting_payments;
DROP POLICY IF EXISTS "Authenticated users can update payments"   ON public.accounting_payments;
DROP POLICY IF EXISTS "Authenticated users can delete payments"   ON public.accounting_payments;

CREATE POLICY "Director and Accounting full access on payments"
  ON public.accounting_payments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ));

-- Sales workflow: apartment payment history per customer/unit. Scoped through
-- the linked invoice — only sales-related invoices are visible to Sales.
CREATE POLICY "Sales can view sales-related payments"
  ON public.accounting_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'Sales'
    )
    AND EXISTS (
      SELECT 1 FROM public.accounting_invoices i
      WHERE i.id = accounting_payments.invoice_id
        AND (i.apartment_id IS NOT NULL OR i.invoice_type = 'OUTGOING_SALES')
    )
  );


-- -----------------------------------------------------------------------------
-- accounting_invoices — add Sales scoped SELECT
-- -----------------------------------------------------------------------------
-- Sales code (salesPaymentsService, useApartmentData) joins to accounting_invoices
-- on payment lookups. Before this migration the join silently returned empty
-- because Sales had no policy here; instead the open accounting_payments policy
-- masked the issue. Tightening accounting_payments would break Sales UI without
-- this companion policy.

CREATE POLICY "Sales can view sales-related invoices"
  ON public.accounting_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'Sales'
    )
    AND (apartment_id IS NOT NULL OR invoice_type = 'OUTGOING_SALES')
  );


-- -----------------------------------------------------------------------------
-- accounting_companies
-- -----------------------------------------------------------------------------
-- Companies are reference/lookup data — names + OIB (public information for
-- Croatian companies). Keep SELECT broadly available so the many side-door
-- lookups across modules keep working. Tighten only the mutations.

DROP POLICY IF EXISTS "Authenticated users can view companies"   ON public.accounting_companies;
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.accounting_companies;
DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.accounting_companies;
DROP POLICY IF EXISTS "Authenticated users can delete companies" ON public.accounting_companies;

CREATE POLICY "Authenticated users can view companies"
  ON public.accounting_companies
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Director and Accounting can mutate companies"
  ON public.accounting_companies
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ));

CREATE POLICY "Director and Accounting can update companies"
  ON public.accounting_companies
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ));

CREATE POLICY "Director can delete companies"
  ON public.accounting_companies
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- -----------------------------------------------------------------------------
-- bank_credits — replace blanket SELECT with role-gated SELECT
-- -----------------------------------------------------------------------------
-- Existing INSERT/UPDATE policies already check role IN ('Director','Accounting',
-- 'Investment'). DELETE is Director-only. Only the SELECT needs tightening.

DROP POLICY IF EXISTS "Authenticated users can access bank credits" ON public.bank_credits;

CREATE POLICY "Finance roles can view bank_credits"
  ON public.bank_credits
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));


-- -----------------------------------------------------------------------------
-- company_loans
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view company loans"   ON public.company_loans;
DROP POLICY IF EXISTS "Authenticated users can create company loans" ON public.company_loans;
DROP POLICY IF EXISTS "Authenticated users can delete company loans" ON public.company_loans;

CREATE POLICY "Director and Accounting full access on company_loans"
  ON public.company_loans
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ));


-- -----------------------------------------------------------------------------
-- company_bank_accounts
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view all bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Users can insert bank accounts"   ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Users can update bank accounts"   ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Users can delete bank accounts"   ON public.company_bank_accounts;

CREATE POLICY "Director and Accounting full access on bank_accounts"
  ON public.company_bank_accounts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ));
