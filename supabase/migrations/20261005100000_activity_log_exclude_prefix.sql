-- =============================================================================
-- get_activity_logs: optional "exclude this action prefix" filter
-- =============================================================================
-- The in-app guidance writes usage events (help.view, help.page_link_click,
-- help.hint_open) to activity_logs. They are not mutations, and on the Director's
-- audit trail they are noise unless asked for. The page now hides them by default.
--
-- The filter has to be here rather than in the client: the RPC paginates and
-- returns total_count, so dropping rows after the fact would leave short pages and
-- a count that includes rows nobody can see.
--
-- Adding a parameter changes the signature, and CREATE OR REPLACE with a different
-- argument list would add an overload beside the old function (which PostgREST then
-- cannot choose between). So the old one is dropped and recreated. The new
-- parameter defaults to NULL: a client that does not send it gets exactly the
-- previous behaviour.
--
-- Until this is applied, the app detects the missing parameter, falls back to the
-- old call, and does not offer the toggle.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_activity_logs(uuid, text, text, text, timestamp with time zone, timestamp with time zone, uuid, integer, integer);

CREATE FUNCTION public.get_activity_logs(
  p_user_id uuid DEFAULT NULL::uuid,
  p_action_prefix text DEFAULT NULL::text,
  p_severity text DEFAULT NULL::text,
  p_search_term text DEFAULT NULL::text,
  p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_project_id uuid DEFAULT NULL::uuid,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50,
  p_exclude_action_prefix text DEFAULT NULL::text
)
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
    AND (p_exclude_action_prefix IS NULL OR al.action NOT LIKE p_exclude_action_prefix || '.%')
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

-- A dropped function takes its grants with it. The function checks for the Director role itself.
GRANT EXECUTE ON FUNCTION public.get_activity_logs(uuid, text, text, text, timestamp with time zone, timestamp with time zone, uuid, integer, integer, text) TO authenticated, service_role;
