-- Sidebar category counts must reflect the active filters on the Documents page
-- (project / subcontractor / file-name search / upload date range). Without this,
-- the per-category numbers on the left stay frozen at their global values even
-- as the right-hand list narrows.
--
-- The selected category itself is intentionally NOT a parameter: counts always
-- represent "documents matching the other filters, grouped by category", so the
-- user can see how each bucket would shrink and pick a different one.

DROP FUNCTION IF EXISTS public.get_document_category_counts();

CREATE OR REPLACE FUNCTION public.get_document_category_counts(
  p_project_id uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_file_name_search text DEFAULT NULL,
  p_uploaded_from timestamptz DEFAULT NULL,
  p_uploaded_to timestamptz DEFAULT NULL
)
RETURNS TABLE(category_id uuid, doc_count bigint)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
STABLE
AS $$
  SELECT d.category_id, count(*)::bigint
  FROM documents d
  WHERE
    (p_project_id IS NULL OR EXISTS (
      SELECT 1 FROM document_associations a
      WHERE a.document_id = d.id
        AND a.entity_type = 'project'
        AND a.entity_id = p_project_id
    ))
    AND (
      p_entity_type IS NULL OR p_entity_id IS NULL
      OR EXISTS (
        SELECT 1 FROM document_associations a
        WHERE a.document_id = d.id
          AND a.entity_type = p_entity_type
          AND a.entity_id = p_entity_id
      )
    )
    AND (p_file_name_search IS NULL OR d.file_name ILIKE p_file_name_search)
    AND (p_uploaded_from IS NULL OR d.uploaded_at >= p_uploaded_from)
    AND (p_uploaded_to IS NULL OR d.uploaded_at <= p_uploaded_to)
  GROUP BY d.category_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_category_counts(
  uuid, text, uuid, text, timestamptz, timestamptz
) TO authenticated;
