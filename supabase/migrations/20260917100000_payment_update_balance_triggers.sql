-- Makes editing a payment move money off the OLD bank account and the OLD credit allocation, not
-- just onto the new ones.
--
-- THE BUG
--
-- Both caches below are maintained by triggers on accounting_payments, and both handle UPDATE
-- wrongly. The Payments page edits a payment with a plain UPDATE (paymentService.updatePayment),
-- so any edit that changes the account, the allocation or the amount leaves stale figures.
--
--   company_bank_accounts.current_balance — update_company_bank_account_balance()
--     The trigger fires on UPDATE, but its INSERT/UPDATE branch recomputes only
--     NEW.company_bank_account_id and NEW.cesija_bank_account_id. Move a payment from account A
--     to account B and B is recomputed; A keeps counting the payment until something else
--     happens to touch it.
--
--   credit_allocations.used_amount — update_credit_allocation_used_amount()
--     The trigger is AFTER INSERT OR DELETE only and the function has no UPDATE branch. Change a
--     payment's amount or its allocation and neither the old nor the new allocation moves.
--
-- THE FIX
--
-- 1. Bank balance. The recompute (initial balance + payments in/out + cesija payments out + loans
--    out/in, all since balance_reset_at) moves VERBATIM into
--    public.recalc_company_bank_account_balance(p_account_id). The trigger function now collects
--    the distinct non-null account ids from NEW (INSERT/UPDATE) and OLD (UPDATE/DELETE) and
--    recomputes each, in id order so two concurrent edits lock accounts in the same order. The
--    balance is a full recompute from the source rows, so recomputing an account one extra time
--    is harmless, and an UPDATE that changes no account recomputes exactly what it did before.
--    Return values are unchanged (OLD for DELETE, NEW otherwise; ignored for AFTER triggers).
--
--    recalculate_balances_on_loan_change() still carries its own copy of the same expression; it
--    is correct for loans (INSERT/DELETE only) and is left alone here.
--
-- 2. Credit allocation used_amount STAYS INCREMENTAL. It is not a cache of payments alone:
--    update_credit_allocation_used_amount_from_invoice() (trigger on accounting_invoices) also
--    adds total_amount of every OUTGOING_BANK invoice linked to the allocation. Recomputing it
--    from payments would wipe those contributions. So the function gains an UPDATE branch that
--    applies the DELETE effect for OLD and then the INSERT effect for NEW — only when amount,
--    credit_allocation_id or cesija_credit_allocation_id actually changed — and the trigger is
--    recreated as AFTER INSERT OR DELETE OR UPDATE OF those three columns. The INSERT and DELETE
--    branches are unchanged.
--
-- 3. EXECUTE on the new helper is revoked from public, anon and authenticated, as for the internal
--    finance functions in 20260916100000_lock_down_finance_definer_functions.sql. The trigger
--    function is SECURITY DEFINER and calls the helper as its owner, so the trigger is unaffected.
--
-- Nothing in the security model changes: no policy, grant on a table, or RLS behaviour is touched.
--
-- WHAT THIS DOES NOT DO
--
-- It does not repair figures that are already wrong from past edits. Run the READ-ONLY checks
-- below first and decide on a repair separately.
--
-- DRIFT CHECK 1 — bank accounts (read-only). Stored current_balance vs the helper's expression.
--
--   SELECT cba.id, cba.bank_name, cba.account_number,
--          cba.current_balance AS stored,
--          x.expected,
--          cba.current_balance - x.expected AS drift
--   FROM company_bank_accounts cba
--   CROSS JOIN LATERAL (
--     SELECT cba.initial_balance
--       + COALESCE((SELECT SUM(CASE
--             WHEN ai.invoice_type IN ('OUTGOING_SALES','OUTGOING_OFFICE','OUTGOING_SUPPLIER',
--                                      'OUTGOING_BANK','OUTGOING_RETAIL_DEVELOPMENT',
--                                      'OUTGOING_RETAIL_CONSTRUCTION') THEN ap.amount
--             WHEN ai.invoice_type IN ('INCOMING_SUPPLIER','INCOMING_OFFICE','INCOMING_INVESTMENT',
--                                      'INCOMING_BANK','INCOMING_BANK_EXPENSES') THEN -ap.amount
--             ELSE 0 END)
--           FROM accounting_payments ap
--           JOIN accounting_invoices ai ON ap.invoice_id = ai.id
--           WHERE ap.company_bank_account_id = cba.id
--             AND (cba.balance_reset_at IS NULL OR ap.payment_date >= cba.balance_reset_at::date)), 0)
--       - COALESCE((SELECT SUM(ap.amount) FROM accounting_payments ap
--           WHERE ap.cesija_bank_account_id = cba.id AND ap.is_cesija = true
--             AND (cba.balance_reset_at IS NULL OR ap.payment_date >= cba.balance_reset_at::date)), 0)
--       - COALESCE((SELECT SUM(cl.amount) FROM company_loans cl
--           WHERE cl.from_bank_account_id = cba.id
--             AND (cba.balance_reset_at IS NULL OR cl.loan_date >= cba.balance_reset_at::date)), 0)
--       + COALESCE((SELECT SUM(cl.amount) FROM company_loans cl
--           WHERE cl.to_bank_account_id = cba.id
--             AND (cba.balance_reset_at IS NULL OR cl.loan_date >= cba.balance_reset_at::date)), 0)
--       AS expected
--   ) x
--   WHERE cba.current_balance IS DISTINCT FROM x.expected
--   ORDER BY abs(cba.current_balance - x.expected) DESC;
--
--   Any row is a stale balance. Once this migration is applied the repair is simply
--   `SELECT public.recalc_company_bank_account_balance(id) FROM company_bank_accounts;` run as
--   postgres/service_role — but that is a write, so it is deliberately not run here.
--
-- DRIFT CHECK 2 — credit allocations (read-only). Stored used_amount vs the sum of what the two
-- triggers add: + payments with credit_allocation_id, − payments with cesija_credit_allocation_id
-- (update_credit_allocation_used_amount), + total_amount of OUTGOING_BANK invoices with
-- credit_allocation_id (update_credit_allocation_used_amount_from_invoice).
--
--   SELECT ca.id, ca.credit_id, ca.allocation_type, ca.project_id,
--          ca.used_amount AS stored,
--          x.expected,
--          ca.used_amount - x.expected AS drift
--   FROM credit_allocations ca
--   CROSS JOIN LATERAL (
--     SELECT COALESCE((SELECT SUM(ap.amount) FROM accounting_payments ap
--                      WHERE ap.credit_allocation_id = ca.id), 0)
--          - COALESCE((SELECT SUM(ap.amount) FROM accounting_payments ap
--                      WHERE ap.cesija_credit_allocation_id = ca.id), 0)
--          + COALESCE((SELECT SUM(ai.total_amount) FROM accounting_invoices ai
--                      WHERE ai.invoice_type = 'OUTGOING_BANK' AND ai.credit_allocation_id = ca.id), 0)
--          AS expected
--   ) x
--   WHERE ca.used_amount IS DISTINCT FROM x.expected
--   ORDER BY abs(ca.used_amount - x.expected) DESC;
--
--   Treat a row as something to investigate, not as proof of this bug. The expression is exact
--   only if the triggers were the sole writers since the allocation was created. It will also
--   differ when: (a) the invoice trigger's GREATEST(0, used_amount - OLD.total_amount) clamp ever
--   engaged — that trigger fires on EVERY update of an OUTGOING_BANK invoice (including the
--   paid_amount/status update each payment causes), and the clamp can engage when cesija payments
--   have pulled used_amount below the invoice total; (b) used_amount was set by hand or by an
--   import; (c) payments or invoices predate the triggers. Because of (a) there is no safe
--   automatic repair for allocations.

-- ------------------------------------------------------------ 1. bank account balance

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
'OUTGOING_SALES',
'OUTGOING_OFFICE',
'OUTGOING_SUPPLIER',
'OUTGOING_BANK',
'OUTGOING_RETAIL_DEVELOPMENT',
'OUTGOING_RETAIL_CONSTRUCTION'
) THEN ap.amount
WHEN ai.invoice_type IN (
'INCOMING_SUPPLIER',
'INCOMING_OFFICE',
'INCOMING_INVESTMENT',
'INCOMING_BANK',
'INCOMING_BANK_EXPENSES'
) THEN -ap.amount
ELSE 0
END
)
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ap.company_bank_account_id = p_account_id
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(ap.amount)
FROM accounting_payments ap
WHERE ap.cesija_bank_account_id = p_account_id
AND ap.is_cesija = true
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.from_bank_account_id = p_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
)
+ COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.to_bank_account_id = p_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
),
updated_at = now()
WHERE id = p_account_id;
END;
$$;

COMMENT ON FUNCTION public.recalc_company_bank_account_balance(uuid) IS
  'Recomputes one company bank account''s current_balance from payments, cesija payments and '
  'company loans since balance_reset_at. Called by update_company_bank_account_balance().';

CREATE OR REPLACE FUNCTION public.update_company_bank_account_balance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
v_account_ids uuid[] := ARRAY[]::uuid[];
v_account_id uuid;
BEGIN
-- Accounts the row points at now...
IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
v_account_ids := array_append(v_account_ids, NEW.company_bank_account_id);
v_account_ids := array_append(v_account_ids, NEW.cesija_bank_account_id);
END IF;

-- ...and the accounts it pointed at before, so an edit that moves the payment (or changes its
-- amount, date or invoice) also takes it off the old account.
IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
v_account_ids := array_append(v_account_ids, OLD.company_bank_account_id);
v_account_ids := array_append(v_account_ids, OLD.cesija_bank_account_id);
END IF;

FOR v_account_id IN
SELECT DISTINCT a.id
FROM unnest(v_account_ids) AS a(id)
WHERE a.id IS NOT NULL
ORDER BY a.id
LOOP
PERFORM public.recalc_company_bank_account_balance(v_account_id);
END LOOP;

IF TG_OP = 'DELETE' THEN
RETURN OLD;
END IF;

RETURN NEW;
END;
$$;

-- update_bank_account_balance_trigger (AFTER INSERT OR DELETE OR UPDATE) already calls this
-- function and needs no change.

-- ------------------------------------------------------------ 2. credit allocation used_amount

CREATE OR REPLACE FUNCTION public.update_credit_allocation_used_amount() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
IF TG_OP = 'INSERT' THEN
IF NEW.credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) + NEW.amount
WHERE id = NEW.credit_allocation_id;
END IF;

IF NEW.cesija_credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) - NEW.amount
WHERE id = NEW.cesija_credit_allocation_id;
END IF;

RETURN NEW;
ELSIF TG_OP = 'UPDATE' THEN
-- Incremental, not a recompute: used_amount also carries OUTGOING_BANK invoice totals from
-- update_credit_allocation_used_amount_from_invoice(). Undo OLD exactly as DELETE does, then
-- apply NEW exactly as INSERT does. The trigger is limited to UPDATE OF these columns, but the
-- app writes every column on save, so skip the no-op case explicitly.
IF NEW.amount IS DISTINCT FROM OLD.amount
OR NEW.credit_allocation_id IS DISTINCT FROM OLD.credit_allocation_id
OR NEW.cesija_credit_allocation_id IS DISTINCT FROM OLD.cesija_credit_allocation_id THEN
-- Reverse OLD (same as the DELETE branch)
IF OLD.credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) - OLD.amount
WHERE id = OLD.credit_allocation_id;
END IF;

IF OLD.cesija_credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) + OLD.amount
WHERE id = OLD.cesija_credit_allocation_id;
END IF;

-- Apply NEW (same as the INSERT branch)
IF NEW.credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) + NEW.amount
WHERE id = NEW.credit_allocation_id;
END IF;

IF NEW.cesija_credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) - NEW.amount
WHERE id = NEW.cesija_credit_allocation_id;
END IF;
END IF;

RETURN NEW;
ELSIF TG_OP = 'DELETE' THEN
IF OLD.credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) - OLD.amount
WHERE id = OLD.credit_allocation_id;
END IF;

IF OLD.cesija_credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) + OLD.amount
WHERE id = OLD.cesija_credit_allocation_id;
END IF;

RETURN OLD;
END IF;

RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_credit_allocation_used_amount ON public.accounting_payments;

CREATE TRIGGER trigger_update_credit_allocation_used_amount
  AFTER INSERT OR DELETE OR UPDATE OF amount, credit_allocation_id, cesija_credit_allocation_id
  ON public.accounting_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_credit_allocation_used_amount();

-- ------------------------------------------------------------ 3. helper is internal-only

REVOKE EXECUTE ON FUNCTION public.recalc_company_bank_account_balance(uuid) FROM public, anon, authenticated;

-- Restated for the same reason as in 20260916100000: the baseline carries no grants, so a
-- project whose access came only through PUBLIC would otherwise lose it for maintenance too.
GRANT EXECUTE ON FUNCTION public.recalc_company_bank_account_balance(uuid) TO service_role;
