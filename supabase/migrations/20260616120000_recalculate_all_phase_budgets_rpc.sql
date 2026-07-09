-- Set-based recalculation of project_phases.budget_used from active/draft contract amounts.
-- Replaces a client-side read-all-contracts loop that silently truncated at PostgREST's
-- 1000-row default once the org exceeded 1000 active+draft contracts, producing understated
-- (corrupted) phase budgets. Mirrors the existing recalculate_bank_credit_fields precedent.

CREATE OR REPLACE FUNCTION public.recalculate_all_phase_budgets() RETURNS void
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.project_phases p
  SET budget_used = COALESCE((
    SELECT SUM(c.contract_amount)
    FROM public.contracts c
    WHERE c.phase_id = p.id
      AND c.status IN ('draft', 'active')
  ), 0);
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_all_phase_budgets() TO authenticated;
