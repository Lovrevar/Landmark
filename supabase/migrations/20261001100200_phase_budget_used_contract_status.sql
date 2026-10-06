/*
  # project_phases.budget_used counts completed and terminated contracts

  DEFECT_BACKLOG SUP-4 (decided 2026-10-01): contracts can now be completed or terminated, and stay
  on the site. What a contract commits against its phase budget:
  - draft, active, completed: its value (`contract_amount`);
  - terminated: what was paid on it (`budget_realized`) — the unspent remainder is released.
  The client rule is `committedAmount` in src/utils/contractRollup.ts; both must stay the same.

  Before, only draft and active contracts counted, so completing a contract would have dropped its
  whole value from the phase.

  1. recalculate_phase_budget_used (the trigger's helper) and recalculate_all_phase_budgets use the rule.
  2. trg_sync_phase_budget_used also fires on budget_realized, which moves a terminated contract's
     commitment as payments arrive.
  3. Every phase is recomputed once.
*/

CREATE OR REPLACE FUNCTION public.contract_committed_amount(p_status text, p_contract_amount numeric, p_budget_realized numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE WHEN p_status = 'terminated' THEN COALESCE(p_budget_realized, 0) ELSE COALESCE(p_contract_amount, 0) END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_phase_budget_used(p_phase_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  WITH committed AS (
    SELECT COALESCE(SUM(public.contract_committed_amount(c.status, c.contract_amount, c.budget_realized)), 0) AS amount
    FROM public.contracts c
    WHERE c.phase_id = p_phase_id
  )
  UPDATE public.project_phases p
  SET budget_used = committed.amount
  FROM committed
  WHERE p.id = p_phase_id
    AND p.budget_used IS DISTINCT FROM committed.amount;
$$;

REVOKE ALL ON FUNCTION public.recalculate_phase_budget_used(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.recalculate_all_phase_budgets() RETURNS void
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.project_phases p
  SET budget_used = COALESCE((
    SELECT SUM(public.contract_committed_amount(c.status, c.contract_amount, c.budget_realized))
    FROM public.contracts c
    WHERE c.phase_id = p.id
  ), 0);
$$;

CREATE OR REPLACE FUNCTION public.sync_phase_budget_used_from_contract() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.phase_id IS NOT NULL THEN
    PERFORM public.recalculate_phase_budget_used(OLD.phase_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.phase_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.phase_id IS DISTINCT FROM OLD.phase_id
          OR NEW.contract_amount IS DISTINCT FROM OLD.contract_amount
          OR NEW.status IS DISTINCT FROM OLD.status
          OR NEW.budget_realized IS DISTINCT FROM OLD.budget_realized) THEN
    PERFORM public.recalculate_phase_budget_used(NEW.phase_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_phase_budget_used ON public.contracts;
CREATE TRIGGER trg_sync_phase_budget_used
  AFTER INSERT OR DELETE OR UPDATE OF phase_id, contract_amount, status, budget_realized ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.sync_phase_budget_used_from_contract();

SELECT public.recalculate_all_phase_budgets();
