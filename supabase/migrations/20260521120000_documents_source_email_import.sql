-- Allow documents created by the email-import edge function (sort-document).
-- Documents forwarded to the documents@ mailbox are classified by Claude and
-- written with source = 'email_import'.

ALTER TABLE public.documents DROP CONSTRAINT documents_source_check;

ALTER TABLE public.documents ADD CONSTRAINT documents_source_check
  CHECK (source = ANY (ARRAY[
    'app_upload'::text,
    'legacy_subcontractor'::text,
    'accounting_sync'::text,
    'filesystem_scan'::text,
    'email_import'::text
  ]));
