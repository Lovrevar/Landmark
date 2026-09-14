/*
  # public.erp_reclassify(run_id) — re-run classification from the UI

  The resolve/promote functions live in `erp`, are SECURITY DEFINER, and are
  granted to `service_role` only. Granting them to `authenticated` directly
  would hand every signed-in user the ability to write to accounting_invoices
  with the definer's rights.

  This wrapper is the supported path for a person: it re-checks the caller's
  role the same way the RLS policies do, then calls resolve and promote for one
  run.

  The loop it exists for: a document lands in the review queue because a code is
  not mapped, someone maps it in Šifrarnici, and then re-runs classification
  here rather than asking accounting to re-export the file.
*/

CREATE OR REPLACE FUNCTION public.erp_reclassify(p_run_id uuid)
RETURNS TABLE (feed text, resolved bigint, unresolved bigint, promoted bigint, skipped bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_feed text;
  v_res  record;
  v_prom record;
BEGIN
  -- The service role calls this from the importer and has no auth.uid(), so it
  -- is admitted on its JWT claim; a person must hold Director or Accounting.
  IF COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.users u
        WHERE u.auth_user_id = auth.uid()
          AND u.role IN ('Director', 'Accounting')
     ) THEN
    RAISE EXCEPTION 'Director or Accounting role required';
  END IF;

  SELECT r.feed INTO v_feed FROM erp.import_runs r WHERE r.id = p_run_id;
  IF v_feed IS NULL THEN
    RAISE EXCEPTION 'no import run %', p_run_id;
  END IF;

  IF v_feed = 'invoices' THEN
    SELECT * INTO v_res  FROM erp.resolve_invoices(p_run_id);
    SELECT * INTO v_prom FROM erp.promote_invoices(p_run_id);
  ELSIF v_feed = 'payments' THEN
    SELECT * INTO v_res  FROM erp.resolve_payments(p_run_id);
    SELECT * INTO v_prom FROM erp.promote_payments(p_run_id);
  ELSE
    -- Reference feeds are written straight to their register on import; there
    -- is nothing staged to reclassify.
    RAISE EXCEPTION 'feed % has nothing to reclassify', v_feed;
  END IF;

  RETURN QUERY SELECT v_feed, v_res.rows_resolved, v_res.rows_unresolved,
                      v_prom.promoted, v_prom.skipped;
END;
$$;

COMMENT ON FUNCTION public.erp_reclassify(uuid) IS
  'Re-runs resolve + promote for one import run after a mapping was fixed. Role-gated wrapper over the erp.* functions, which are service_role only.';

REVOKE ALL ON FUNCTION public.erp_reclassify(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.erp_reclassify(uuid) TO authenticated, service_role;
