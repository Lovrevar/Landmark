/*
  # Create function to get filtered activity logs

  1. New Functions
    - `get_activity_logs` - Returns filtered, paginated activity log entries
      with user and project names resolved via JOINs.

  2. Purpose
    - Paginated reverse-chronological activity log for the Director dashboard
    - Filters: user, action category (prefix match), severity, free-text search,
      date range, project
    - total_count returned via window function so the frontend can paginate
      with a single RPC call

  3. Security
    - SECURITY DEFINER with search_path = public
    - Verifies the caller is a Director before returning any rows
*/

CREATE OR REPLACE FUNCTION get_activity_logs(
  p_user_id       uuid        DEFAULT NULL,
  p_action_prefix text        DEFAULT NULL,
  p_severity      text        DEFAULT NULL,
  p_search_term   text        DEFAULT NULL,
  p_date_from     timestamptz DEFAULT NULL,
  p_date_to       timestamptz DEFAULT NULL,
  p_project_id    uuid        DEFAULT NULL,
  p_offset        integer     DEFAULT 0,
  p_limit         integer     DEFAULT 50
)
RETURNS TABLE (
  id           uuid,
  user_id      uuid,
  username     text,
  user_role    text,
  action       text,
  entity       text,
  entity_id    uuid,
  project_id   uuid,
  project_name text,
  metadata     jsonb,
  ip_address   text,
  created_at   timestamptz,
  total_count  bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
