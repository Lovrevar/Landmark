-- Makes `contracts.budget_realized` a trustworthy cache of what has actually been paid, and
-- settles which of the app's two "paid" figures is the source of truth.
--
-- THE FACTS
--
-- Two columns cache the same underlying fact, `sum(accounting_payments.amount)`:
--
--   accounting_invoices.paid_amount  -- payments for ONE invoice   (update_invoice_payment_status)
--   contracts.budget_realized        -- payments across a contract (update_contract_budget_realized)
--
-- In production the invoice cache is exact for all 145 contracts. The contract cache is wrong for
-- three of them, and Zona 31's headline "paid" was €25.000 too high because of one.
--
-- WHY ONLY THE CONTRACT CACHE DRIFTS
--
-- `update_invoice_payment_status` keys on the payment's own invoice, so nothing outside that
-- invoice can invalidate it. `update_contract_budget_realized` reaches the contract through
-- `accounting_invoices.contract_id` — and NOTHING recomputes it when that link changes:
--
--   1. accounting_payments_invoice_id_fkey is ON DELETE CASCADE. Deleting an invoice deletes its
--      payments, and each cascaded payment fires the AFTER DELETE trigger — which looks up
--      `SELECT contract_id FROM accounting_invoices WHERE id = OLD.invoice_id`. The invoice row is
--      already gone, so v_contract_id is NULL, the guard skips the UPDATE, and that payment's
--      money stays in budget_realized permanently. This is what happened to 4 UHA d.o.o. on
--      Zona 31: 35.000 frozen in against a single surviving 10.000 payment.
--   2. Re-pointing an invoice at a different contract, or unlinking it, leaves BOTH the old and
--      the new contract stale. No trigger on accounting_invoices touches budget_realized at all.
--
-- There is also a live landmine: fix_subcontractor_budget_integrity() sets
-- `budget_realized = sum(accounting_invoices.base_amount)` — INVOICED, not PAID. Whoever wrote it
-- meant it as a repair; running it today would overwrite all 145 contracts with a different
-- quantity. It is replaced below rather than left for someone to find and trust.
--
-- THE DECISION
--
-- `accounting_payments` is the source of truth. `contracts.budget_realized` is its per-contract
-- cache and, once the two gaps above are closed, is structurally sound — so it becomes the single
-- figure the app reads for "paid on a contract", and the invoice-level query survives only where
-- the caller also needs what is still OWED, which payments alone cannot answer.

-- ------------------------------------------------------------------ one shared recompute

CREATE OR REPLACE FUNCTION public.recalculate_contract_budget_realized(p_contract_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  UPDATE public.contracts c
     SET budget_realized = COALESCE((
           SELECT SUM(ap.amount)
             FROM public.accounting_payments ap
             JOIN public.accounting_invoices ai ON ai.id = ap.invoice_id
            WHERE ai.contract_id = p_contract_id
         ), 0)
   WHERE c.id = p_contract_id
     AND c.budget_realized IS DISTINCT FROM COALESCE((
           SELECT SUM(ap.amount)
             FROM public.accounting_payments ap
             JOIN public.accounting_invoices ai ON ai.id = ap.invoice_id
            WHERE ai.contract_id = p_contract_id
         ), 0);
$$;

COMMENT ON FUNCTION public.recalculate_contract_budget_realized(uuid) IS
  'Recomputes one contract''s budget_realized from accounting_payments, the source of truth. '
  'The no-op guard keeps it cheap to call from triggers that may fire per row.';

-- ------------------------------------------------- payments: unchanged behaviour, shared body

CREATE OR REPLACE FUNCTION public.update_contract_budget_realized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_contract_id uuid;
BEGIN
  SELECT contract_id INTO v_contract_id
    FROM public.accounting_invoices
   WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Still NULL when the invoice is already gone (a cascaded delete). That case is now covered by
  -- the AFTER DELETE trigger on accounting_invoices below, which recomputes from the contract
  -- side once the cascade has finished.
  IF v_contract_id IS NOT NULL THEN
    PERFORM public.recalculate_contract_budget_realized(v_contract_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

-- ------------------------------------------- invoices: the link itself must invalidate the cache

CREATE OR REPLACE FUNCTION public.sync_contract_budget_realized_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Both sides on a re-link: the money leaves one contract and joins another.
  IF TG_OP <> 'INSERT' AND OLD.contract_id IS NOT NULL THEN
    PERFORM public.recalculate_contract_budget_realized(OLD.contract_id);
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.contract_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.contract_id IS DISTINCT FROM OLD.contract_id) THEN
    PERFORM public.recalculate_contract_budget_realized(NEW.contract_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

COMMENT ON FUNCTION public.sync_contract_budget_realized_from_invoice() IS
  'Keeps contracts.budget_realized correct when an invoice is deleted (its payments cascade away) '
  'or re-pointed at another contract. Without this the cache only ever grew.';

DROP TRIGGER IF EXISTS trg_sync_contract_budget_realized_from_invoice ON public.accounting_invoices;

-- AFTER, so the cascaded payment deletes have already happened by the time we recount.
CREATE TRIGGER trg_sync_contract_budget_realized_from_invoice
  AFTER INSERT OR DELETE OR UPDATE OF contract_id ON public.accounting_invoices
  FOR EACH ROW EXECUTE FUNCTION public.sync_contract_budget_realized_from_invoice();

-- --------------------------------------------------- replace the contradicting repair function

-- Previously: budget_realized = sum(accounting_invoices.base_amount) — invoiced, not paid, and
-- net of VAT besides. Kept under the same name so any existing caller gets the correct behaviour
-- rather than a missing-function error.
CREATE OR REPLACE FUNCTION public.fix_subcontractor_budget_integrity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.contracts LOOP
    PERFORM public.recalculate_contract_budget_realized(r.id);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.fix_subcontractor_budget_integrity() IS
  'Recomputes every contract''s budget_realized from accounting_payments. Safe to run at any '
  'time; it is the same arithmetic the triggers apply. Before 20260910120000 this function set '
  'budget_realized to the sum of INVOICED base amounts, a different quantity entirely.';

-- ------------------------------------------------------------------------------ repair + assert

DO $repair$
DECLARE
  v_before integer;
  v_after  integer;
  v_rec    record;
BEGIN
  SELECT count(*) INTO v_before FROM public.contracts c
   WHERE COALESCE(c.budget_realized, 0) IS DISTINCT FROM COALESCE((
     SELECT SUM(ap.amount) FROM public.accounting_payments ap
       JOIN public.accounting_invoices ai ON ai.id = ap.invoice_id
      WHERE ai.contract_id = c.id), 0);

  FOR v_rec IN
    SELECT s.name AS subcontractor, p.name AS project, c.budget_realized AS was,
           COALESCE((SELECT SUM(ap.amount) FROM public.accounting_payments ap
                       JOIN public.accounting_invoices ai ON ai.id = ap.invoice_id
                      WHERE ai.contract_id = c.id), 0) AS becomes
      FROM public.contracts c
      LEFT JOIN public.subcontractors s ON s.id = c.subcontractor_id
      LEFT JOIN public.projects p ON p.id = c.project_id
     WHERE COALESCE(c.budget_realized, 0) IS DISTINCT FROM COALESCE((
       SELECT SUM(ap.amount) FROM public.accounting_payments ap
         JOIN public.accounting_invoices ai ON ai.id = ap.invoice_id
        WHERE ai.contract_id = c.id), 0)
  LOOP
    RAISE NOTICE 'REPAIR: % on % — budget_realized % -> %',
      v_rec.subcontractor, COALESCE(v_rec.project, '(no project)'), v_rec.was, v_rec.becomes;
  END LOOP;

  PERFORM public.fix_subcontractor_budget_integrity();

  SELECT count(*) INTO v_after FROM public.contracts c
   WHERE COALESCE(c.budget_realized, 0) IS DISTINCT FROM COALESCE((
     SELECT SUM(ap.amount) FROM public.accounting_payments ap
       JOIN public.accounting_invoices ai ON ai.id = ap.invoice_id
      WHERE ai.contract_id = c.id), 0);

  IF v_after <> 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORT: % contract(s) still disagree with accounting_payments', v_after;
  END IF;

  -- The two caches must now agree with each other as well, which is the property every screen
  -- in the app depends on.
  IF EXISTS (
    SELECT 1 FROM public.contracts c
      JOIN (SELECT contract_id, SUM(paid_amount) AS paid FROM public.accounting_invoices
             WHERE contract_id IS NOT NULL GROUP BY 1) inv ON inv.contract_id = c.id
     WHERE abs(COALESCE(c.budget_realized, 0) - COALESCE(inv.paid, 0)) > 0.01
  ) THEN
    RAISE EXCEPTION 'MIGRATION ABORT: budget_realized still disagrees with invoice paid_amount';
  END IF;

  RAISE NOTICE 'budget_realized repaired: % contract(s) corrected, all % now agree with payments',
    v_before, (SELECT count(*) FROM public.contracts);
END $repair$;
