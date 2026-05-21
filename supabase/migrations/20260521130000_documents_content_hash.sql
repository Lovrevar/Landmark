-- SHA-256 of the file bytes, used by the sort-document edge function to detect
-- and skip duplicate email imports (e.g. Make.com retries). NULL for documents
-- created by other paths (in-app upload, legacy import).
ALTER TABLE public.documents ADD COLUMN content_hash text;

-- Partial index — only email-imported rows populate the column.
CREATE INDEX IF NOT EXISTS idx_documents_content_hash
  ON public.documents (content_hash)
  WHERE content_hash IS NOT NULL;
