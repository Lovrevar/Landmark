-- Follow-up to baseline migration: normalizes function definitions to match
-- prod's pg_catalog representation exactly. The original baseline's function
-- bodies (from pg_dump) differ from prod's stored versions only in whitespace
-- and clause ordering — semantically identical, but Supabase CLI's diff tool
-- flags the textual differences. Applying these CREATE OR REPLACE statements
-- brings the shadow database byte-identical to prod.
--
-- Generated from: supabase db diff --linked --schema public
-- (after applying 00000000000000_baseline_schema.sql)

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_activity_logs(p_user_id uuid DEFAULT NULL::uuid, p_action_prefix text DEFAULT NULL::text, p_severity text DEFAULT NULL::text, p_search_term text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_project_id uuid DEFAULT NULL::uuid, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, user_id uuid, username text, user_role text, action text, entity text, entity_id uuid, project_id uuid, project_name text, metadata jsonb, ip_address text, created_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only Director may read activity logs
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Director role required';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.user_id,
    u.username,
    al.user_role,
    al.action,
    al.entity,
    al.entity_id,
    al.project_id,
    p.name        AS project_name,
    al.metadata,
    al.ip_address,
    al.created_at,
    COUNT(*) OVER() AS total_count
  FROM activity_logs al
  JOIN users u ON u.id = al.user_id
  LEFT JOIN projects p ON p.id = al.project_id
  WHERE
    (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_action_prefix IS NULL OR al.action LIKE p_action_prefix || '.%')
    AND (p_severity IS NULL OR al.metadata->>'severity' = p_severity)
    AND (p_date_from IS NULL OR al.created_at >= p_date_from)
    AND (p_date_to IS NULL OR al.created_at <= p_date_to)
    AND (p_project_id IS NULL OR al.project_id = p_project_id)
    AND (
      p_search_term IS NULL
      OR p_search_term = ''
      OR al.action ILIKE '%' || p_search_term || '%'
      OR al.entity ILIKE '%' || p_search_term || '%'
      OR u.username ILIKE '%' || p_search_term || '%'
      OR al.metadata::text ILIKE '%' || p_search_term || '%'
    )
  ORDER BY al.created_at DESC
  OFFSET p_offset
  LIMIT p_limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_busy_blocks(p_user_ids uuid[], p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(user_id uuid, start_at timestamp with time zone, end_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ep.user_id, e.start_at, e.end_at
  FROM calendar_events e
  JOIN calendar_event_participants ep ON ep.event_id = e.id
  WHERE e.busy = true
    AND ep.user_id = ANY(p_user_ids)
    AND e.start_at < p_to
    AND e.end_at   > p_from
  UNION
  SELECT e.created_by, e.start_at, e.end_at
  FROM calendar_events e
  WHERE e.busy = true
    AND e.created_by = ANY(p_user_ids)
    AND e.start_at < p_to
    AND e.end_at   > p_from;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_bank_credit_fields(p_credit_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_used   numeric;
  v_repaid numeric;
BEGIN
  IF p_credit_id IS NULL THEN
    RETURN;
  END IF;

  -- used_amount: money deployed FROM this credit line (unchanged)
  --   Path A: direct credit_id on payment (credit allocation / direct supplier payment)
  --   Path B: cesija_credit_id on payment (cesija / assignment path)
  --   Path C: payments against OUTGOING_BANK invoices linked to this credit
  --   UNION to deduplicate payment ids that may appear in multiple paths
  SELECT COALESCE(SUM(ap.amount), 0)
  INTO v_used
  FROM accounting_payments ap
  WHERE ap.id IN (
    SELECT id FROM accounting_payments WHERE credit_id = p_credit_id
    UNION
    SELECT id FROM accounting_payments WHERE cesija_credit_id = p_credit_id
    UNION
    SELECT ap2.id
    FROM accounting_payments ap2
    JOIN accounting_invoices ai ON ap2.invoice_id = ai.id
    WHERE ai.invoice_type = 'OUTGOING_BANK'
      AND ai.bank_credit_id = p_credit_id
  );

  -- repaid_amount: base amount (ex-VAT) paid back to the lender
  -- Using ap.amount * (base_amount / total_amount) to extract the ex-VAT portion.
  -- When fully paid: ap.amount = total_amount → result equals base_amount exactly.
  SELECT COALESCE(SUM(
    ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0))
  ), 0)
  INTO v_repaid
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.invoice_type = 'INCOMING_BANK'
    AND ai.bank_credit_id = p_credit_id
    AND ai.total_amount > 0;

  UPDATE bank_credits
  SET
    used_amount         = v_used,
    repaid_amount       = v_repaid,
    outstanding_balance = v_used - v_repaid
  WHERE id = p_credit_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.replace_document_associations(p_document_id uuid, p_associations jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM document_associations WHERE document_id = p_document_id;

  IF p_associations IS NOT NULL AND jsonb_array_length(p_associations) > 0 THEN
    INSERT INTO document_associations (document_id, entity_type, entity_id)
    SELECT p_document_id,
           a->>'entityType',
           (a->>'entityId')::uuid
    FROM jsonb_array_elements(p_associations) a;
  END IF;
END;
$function$
;



