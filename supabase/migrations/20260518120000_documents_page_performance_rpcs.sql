-- Documents page performance: grouped sidebar counts + paginated search.
-- See plan: /home/user/.claude/plans/in-supervision-invoices-and-snoopy-newt.md

-- ---------------------------------------------------------------------------
-- get_document_category_counts: one round-trip for the sidebar tree.
-- Replaces the prior "fetch every documents.category_id and count in JS" path.
-- NULL category_id rows appear as (NULL, n) and roll into the page-level total
-- but no tree node claims them (matches the existing UI behaviour).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_document_category_counts()
RETURNS TABLE(category_id uuid, doc_count bigint)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
STABLE
AS $$
  SELECT category_id, count(*)::bigint
  FROM documents
  GROUP BY category_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_category_counts() TO authenticated;

-- ---------------------------------------------------------------------------
-- search_documents: paginated list + filter + total_count in one round-trip.
-- Returns rows of (document jsonb, total_count bigint). The `document` payload
-- mirrors the shape previously produced by `select('*, category(*), associations(*))'`
-- so the TypeScript layer's DocumentWithRelations decoding is unchanged.
--
-- All filter arguments are optional (NULL = no filter). When p_entity_type and
-- p_entity_id are both provided, results are intersected with documents that
-- have a matching association (EXISTS subquery — single DB round-trip, no
-- JS-side intersection).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_documents(
  p_category_ids uuid[] DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_file_name_search text DEFAULT NULL,
  p_uploaded_from timestamptz DEFAULT NULL,
  p_uploaded_to timestamptz DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(document jsonb, total_count bigint)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
STABLE
AS $$
  WITH filtered AS (
    SELECT d.id, d.uploaded_at
    FROM documents d
    WHERE
      (p_category_ids IS NULL OR d.category_id = ANY(p_category_ids))
      AND (p_project_id IS NULL OR EXISTS (
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
  ),
  page AS (
    SELECT id
    FROM filtered
    ORDER BY uploaded_at DESC
    OFFSET GREATEST(p_offset, 0)
    LIMIT GREATEST(p_limit, 0)
  ),
  total AS (
    SELECT count(*)::bigint AS n FROM filtered
  )
  SELECT
    jsonb_build_object(
      'id', d.id,
      'file_path', d.file_path,
      'file_name', d.file_name,
      'file_size', d.file_size,
      'mime_type', d.mime_type,
      'category_id', d.category_id,
      'source', d.source,
      'description', d.description,
      'uploaded_by', d.uploaded_by,
      'uploaded_at', d.uploaded_at,
      'category', (
        SELECT to_jsonb(cat) FROM document_categories cat WHERE cat.id = d.category_id
      ),
      'associations', COALESCE(
        (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM document_associations a WHERE a.document_id = d.id),
        '[]'::jsonb
      )
    ) AS document,
    (SELECT n FROM total) AS total_count
  FROM page p
  JOIN documents d ON d.id = p.id
  ORDER BY d.uploaded_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_documents(uuid[], uuid, text, uuid, text, timestamptz, timestamptz, integer, integer) TO authenticated;
