/*
  # Cashflow: one bank-balance formula, safe opening balances, matching invoice statistics

  DEFECT_BACKLOG CASH-1, CASH-2, CASH-4, CASH-5.

  1. Credit disbursements are part of the balance formula (CASH-2)
     A credit flagged "disbursed to account" added its amount to current_balance with `+=` in a
     BEFORE trigger on bank_credits, but recalc_company_bank_account_balance() rebuilds the balance
     from source rows and never counted disbursements, so the next payment or loan on that account
     erased them. The formula now adds disbursed credits (by start_date, respecting
     balance_reset_at). The bank_credits triggers keep setting used_amount/outstanding_balance but
     no longer touch the balance; an AFTER trigger recomputes the old and new target accounts.
     recalculate_balances_on_loan_change(), which carried a second copy of the formula, now calls
     the same function, so there is exactly one formula.

  2. Balance resets and opening balances go through the database (CASH-1)
     New companies stored the opening balance in current_balance with initial_balance = 0, so the
     first recompute wiped it; the Companies screen then rebuilt balances in the browser with a
     third copy of the formula (capped at 1000 rows). reset_company_bank_account_balance() sets
     initial/current balance and balance_reset_at and runs the one formula. Director and
     Accounting only.
     Backfill: accounts that still show an opening balance only in current_balance (initial 0, no
     reset, nothing ever posted against them) get initial_balance = current_balance and
     balance_reset_at = created_at. Accounts whose opening balance was already wiped cannot be
     recovered automatically; the query at the end lists candidates to check by hand.

  3. get_invoice_statistics() matches get_filtered_invoices() (CASH-4)
     Same joins (supplier through supplier_id, not through the contract) and the same search
     predicate, so the count above the list agrees with the rows in it.

  4. invoice_categories can be managed by Directors (CASH-5)
     The policy compared the role with 'director' in lower case, which never matches.
*/

-- ---------------------------------------------------------------------------
-- 1. Balance formula with credit disbursements
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalc_company_bank_account_balance(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_reset_at timestamptz;
BEGIN
  IF p_account_id IS NULL THEN
    RETURN;
  END IF;

  SELECT balance_reset_at INTO v_reset_at
  FROM company_bank_accounts
  WHERE id = p_account_id;

  UPDATE company_bank_accounts
  SET current_balance = initial_balance
    + COALESCE(
        (SELECT SUM(
           CASE
             WHEN ai.invoice_type IN (
               'OUTGOING_SALES', 'OUTGOING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_BANK',
               'OUTGOING_RETAIL_DEVELOPMENT', 'OUTGOING_RETAIL_CONSTRUCTION'
             ) THEN ap.amount
             WHEN ai.invoice_type IN (
               'INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'INCOMING_INVESTMENT',
               'INCOMING_BANK', 'INCOMING_BANK_EXPENSES'
             ) THEN -ap.amount
             ELSE 0
           END)
         FROM accounting_payments ap
         JOIN accounting_invoices ai ON ap.invoice_id = ai.id
         WHERE ap.company_bank_account_id = p_account_id
           AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
        ), 0)
    - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = p_account_id
           AND ap.is_cesija = true
           AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
        ), 0)
    - COALESCE(
        (SELECT SUM(cl.amount)
         FROM company_loans cl
         WHERE cl.from_bank_account_id = p_account_id
           AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
        ), 0)
    + COALESCE(
        (SELECT SUM(cl.amount)
         FROM company_loans cl
         WHERE cl.to_bank_account_id = p_account_id
           AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
        ), 0)
    + COALESCE(
        (SELECT SUM(bc.amount)
         FROM bank_credits bc
         WHERE bc.disbursed_to_account = true
           AND bc.disbursed_to_bank_account_id = p_account_id
           AND (v_reset_at IS NULL OR bc.start_date >= v_reset_at::date)
        ), 0),
      updated_at = now()
  WHERE id = p_account_id;
END;
$$;

COMMENT ON FUNCTION public.recalc_company_bank_account_balance(uuid) IS
  'The one bank-balance formula: initial_balance plus payments, cesija payments, company loans and '
  'credits disbursed to the account since balance_reset_at. Called by the payment, loan and '
  'bank_credits triggers and by reset_company_bank_account_balance().';

REVOKE ALL ON FUNCTION public.recalc_company_bank_account_balance(uuid) FROM public, anon, authenticated;

-- Loans: delegate to the one formula instead of carrying a copy of it.
CREATE OR REPLACE FUNCTION public.recalculate_balances_on_loan_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_company_bank_account_balance(NEW.from_bank_account_id);
    PERFORM public.recalc_company_bank_account_balance(NEW.to_bank_account_id);
    RETURN NEW;
  END IF;
  PERFORM public.recalc_company_bank_account_balance(OLD.from_bank_account_id);
  PERFORM public.recalc_company_bank_account_balance(OLD.to_bank_account_id);
  RETURN OLD;
END;
$$;

-- bank_credits BEFORE triggers: keep the credit's own figures, stop editing balances.
CREATE OR REPLACE FUNCTION public.handle_disbursed_credit_balance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.disbursed_to_account = true AND NEW.disbursed_to_bank_account_id IS NOT NULL THEN
    NEW.used_amount         := NEW.amount;
    NEW.outstanding_balance := NEW.amount;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_disbursed_credit_balance_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- The balance is recomputed by trg_recalc_balance_on_credit_change after the delete.
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_disbursed_credit_balance_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_repaid numeric;
BEGIN
  IF OLD.disbursed_to_account = false AND NEW.disbursed_to_account = true AND NEW.disbursed_to_bank_account_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ap.amount), 0)
    INTO v_repaid
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.invoice_type = 'INCOMING_BANK'
      AND ai.bank_credit_id = NEW.id;

    NEW.used_amount         := NEW.amount;
    NEW.outstanding_balance := NEW.amount - v_repaid;
  END IF;

  IF OLD.disbursed_to_account = true AND NEW.disbursed_to_account = false THEN
    NEW.used_amount         := 0;
    NEW.outstanding_balance := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_balance_on_credit_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.disbursed_to_account THEN
    PERFORM public.recalc_company_bank_account_balance(OLD.disbursed_to_bank_account_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.disbursed_to_account
     AND (TG_OP = 'INSERT' OR NEW.disbursed_to_bank_account_id IS DISTINCT FROM OLD.disbursed_to_bank_account_id
          OR NOT OLD.disbursed_to_account OR NEW.amount IS DISTINCT FROM OLD.amount
          OR NEW.start_date IS DISTINCT FROM OLD.start_date) THEN
    PERFORM public.recalc_company_bank_account_balance(NEW.disbursed_to_bank_account_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_balance_on_credit_change ON public.bank_credits;
CREATE TRIGGER trg_recalc_balance_on_credit_change
  AFTER INSERT OR DELETE OR UPDATE OF disbursed_to_account, disbursed_to_bank_account_id, amount, start_date
  ON public.bank_credits
  FOR EACH ROW EXECUTE FUNCTION public.recalc_balance_on_credit_change();

-- ---------------------------------------------------------------------------
-- 2. Balance resets through the database, and the opening-balance backfill
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reset_company_bank_account_balance(
  p_account_id uuid,
  p_balance    numeric,
  p_reset_at   timestamptz DEFAULT now()
) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF COALESCE(public.app_user_role(), '') NOT IN ('Director', 'Accounting') THEN
    RAISE EXCEPTION 'reset_company_bank_account_balance requires the Director or Accounting role'
      USING ERRCODE = '42501';
  END IF;

  UPDATE company_bank_accounts
  SET initial_balance  = COALESCE(p_balance, 0),
      current_balance  = COALESCE(p_balance, 0),
      balance_reset_at = COALESCE(p_reset_at, now()),
      updated_at       = now()
  WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bank account % not found', p_account_id USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.recalc_company_bank_account_balance(p_account_id);

  SELECT current_balance INTO v_balance FROM company_bank_accounts WHERE id = p_account_id;
  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_company_bank_account_balance(uuid, numeric, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_company_bank_account_balance(uuid, numeric, timestamptz) TO authenticated;

UPDATE public.company_bank_accounts a
SET initial_balance  = a.current_balance,
    balance_reset_at = COALESCE(a.created_at, now())
WHERE a.initial_balance = 0
  AND a.current_balance <> 0
  AND a.balance_reset_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.accounting_payments ap
                  WHERE ap.company_bank_account_id = a.id OR ap.cesija_bank_account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.company_loans cl
                  WHERE cl.from_bank_account_id = a.id OR cl.to_bank_account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.bank_credits bc
                  WHERE bc.disbursed_to_account AND bc.disbursed_to_bank_account_id = a.id);

-- ---------------------------------------------------------------------------
-- 3. get_invoice_statistics() with the list's joins and search
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_invoice_statistics(
  p_invoice_type text DEFAULT 'ALL'::text,
  p_status       text DEFAULT 'ALL'::text,
  p_company_id   uuid DEFAULT NULL::uuid,
  p_search_term  text DEFAULT NULL::text
) RETURNS TABLE(
  filtered_count      bigint,
  filtered_unpaid_sum numeric,
  total_unpaid_sum    numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND role IN ('Director', 'Accounting')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege: get_invoice_statistics requires Director or Accounting role';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    -- Keep the joins and the search predicate identical to get_filtered_invoices().
    SELECT ai.status, ai.remaining_amount
    FROM accounting_invoices ai
    LEFT JOIN accounting_companies       ac  ON ai.company_id         = ac.id
    LEFT JOIN subcontractors             sub ON ai.supplier_id        = sub.id
    LEFT JOIN customers                  c   ON ai.customer_id        = c.id
    LEFT JOIN banks                      bk  ON ai.bank_id            = bk.id
    LEFT JOIN office_suppliers           os  ON ai.office_supplier_id = os.id
    LEFT JOIN retail_suppliers           rs  ON ai.retail_supplier_id = rs.id
    LEFT JOIN retail_customers           rc  ON ai.retail_customer_id = rc.id
    LEFT JOIN retail_projects            rp  ON ai.retail_project_id  = rp.id
    LEFT JOIN accounting_invoices_refund ref ON ai.refund_id          = ref.id
    WHERE
      (
        p_invoice_type = 'ALL'
        OR ai.invoice_type = p_invoice_type
        OR (p_invoice_type IN ('INCOMING', 'OUTGOING') AND ai.invoice_type LIKE p_invoice_type || '_%')
      )
      AND (
        p_status = 'ALL'
        OR (p_status = 'UNPAID'             AND ai.status = 'UNPAID')
        OR (p_status = 'PAID'               AND ai.status = 'PAID')
        OR (p_status = 'PARTIALLY_PAID'     AND ai.status = 'PARTIALLY_PAID')
        OR (p_status = 'UNPAID_AND_PARTIAL' AND ai.status IN ('UNPAID', 'PARTIALLY_PAID'))
      )
      AND (p_company_id IS NULL OR ai.company_id = p_company_id)
      AND (
        p_search_term IS NULL
        OR ai.invoice_number ILIKE '%' || p_search_term || '%'
        OR ai.category       ILIKE '%' || p_search_term || '%'
        OR ai.description    ILIKE '%' || p_search_term || '%'
        OR rs.name           ILIKE '%' || p_search_term || '%'
        OR os.name           ILIKE '%' || p_search_term || '%'
        OR sub.name          ILIKE '%' || p_search_term || '%'
        OR c.name            ILIKE '%' || p_search_term || '%'
        OR c.surname         ILIKE '%' || p_search_term || '%'
        OR rc.name           ILIKE '%' || p_search_term || '%'
        OR bk.name           ILIKE '%' || p_search_term || '%'
        OR ac.name           ILIKE '%' || p_search_term || '%'
        OR ref.name          ILIKE '%' || p_search_term || '%'
        OR rp.name           ILIKE '%' || p_search_term || '%'
      )
  ),
  totals AS (
    SELECT
      COUNT(*) AS filtered_count,
      COALESCE(SUM(f.remaining_amount) FILTER (WHERE f.status IN ('UNPAID', 'PARTIALLY_PAID')), 0) AS filtered_unpaid_sum
    FROM filtered f
  ),
  all_unpaid AS (
    SELECT COALESCE(SUM(x.remaining_amount), 0) AS total_unpaid_sum
    FROM accounting_invoices x
    WHERE x.status IN ('UNPAID', 'PARTIALLY_PAID')
      AND (
        p_invoice_type = 'ALL'
        OR (p_invoice_type = 'INCOMING' AND x.invoice_type LIKE 'INCOMING_%')
        OR (p_invoice_type = 'OUTGOING' AND x.invoice_type LIKE 'OUTGOING_%')
        OR (p_invoice_type NOT IN ('ALL', 'INCOMING', 'OUTGOING')
            AND x.invoice_type LIKE split_part(p_invoice_type, '_', 1) || '_%')
      )
  )
  SELECT t.filtered_count, t.filtered_unpaid_sum, a.total_unpaid_sum
  FROM totals t
  CROSS JOIN all_unpaid a;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. invoice_categories: Director can manage
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can manage invoice categories"   ON public.invoice_categories;
DROP POLICY IF EXISTS "Director can manage invoice categories" ON public.invoice_categories;
CREATE POLICY "Director can manage invoice categories" ON public.invoice_categories
  FOR ALL TO authenticated
  USING (public.app_user_role() = 'Director')
  WITH CHECK (public.app_user_role() = 'Director');

-- ---------------------------------------------------------------------------
-- Manual check after applying (read-only): accounts whose opening balance may already have been
-- wiped by CASH-1 before this migration — created with a balance, then recomputed from 0.
--
--   SELECT a.id, co.name AS company, a.bank_name, a.created_at, a.current_balance
--   FROM company_bank_accounts a
--   JOIN accounting_companies co ON co.id = a.company_id
--   WHERE a.initial_balance = 0 AND a.balance_reset_at IS NULL
--   ORDER BY a.created_at;
--
-- For each, confirm the real balance and set it on the Companies screen (edit → balance reset).
-- ---------------------------------------------------------------------------
