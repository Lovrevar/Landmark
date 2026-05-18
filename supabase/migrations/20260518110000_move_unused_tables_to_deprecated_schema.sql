-- Move tables that are no longer referenced by application code or DB logic
-- into a `deprecated` schema. Keeps the data + structure intact (reversible
-- with `ALTER TABLE ... SET SCHEMA public`) and removes them from the
-- PostgREST API surface (Supabase only exposes `public` by default).
--
-- Excluded from this batch because PL/pgSQL functions or triggers in the
-- baseline schema still reference them:
--   * investors             -- used by count_invoices_with_search, get_filtered_invoices
--   * project_investments   -- used by generate_payment_schedule + 3 triggers
--   * funding_payments      -- used by get_bank_credit_payments + 1 trigger

CREATE SCHEMA IF NOT EXISTS deprecated;

-- Keep PostgREST off the deprecated schema explicitly (defense in depth;
-- Supabase already restricts exposed schemas via the dashboard config).
REVOKE ALL ON SCHEMA deprecated FROM anon, authenticated;
GRANT USAGE ON SCHEMA deprecated TO postgres, service_role;

-- companies: 10 rows, 0 incoming FKs, never queried (the app uses
-- accounting_companies instead).
ALTER TABLE IF EXISTS public.companies SET SCHEMA deprecated;

-- leads: 0 rows, 0 incoming FKs, never queried.
ALTER TABLE IF EXISTS public.leads SET SCHEMA deprecated;

-- old_invoices: 0 rows. Name explicitly marks it as superseded.
ALTER TABLE IF EXISTS public.old_invoices SET SCHEMA deprecated;

-- subcontractor_documents: 4 rows. documentService.ts comment confirms the
-- migration to the unified `documents` + `document_associations` pair.
ALTER TABLE IF EXISTS public.subcontractor_documents SET SCHEMA deprecated;

-- task_reminder_sends: 0 rows. Planned but never wired up; the equivalent
-- calendar_reminder_sends *is* populated by the dispatch-calendar-reminders
-- edge function, but no dispatch-task-reminders function exists.
ALTER TABLE IF EXISTS public.task_reminder_sends SET SCHEMA deprecated;

-- Strip API privileges on the moved tables so neither anon nor authenticated
-- can hit them via PostgREST even if the schema is later exposed.
REVOKE ALL ON TABLE
  deprecated.companies,
  deprecated.leads,
  deprecated.old_invoices,
  deprecated.subcontractor_documents,
  deprecated.task_reminder_sends
FROM anon, authenticated;
