/*
  # Security hardening from the September 2026 defect audit

  Fixes docs/DEFECT_BACKLOG.md SEC-A1, SEC-A2, SEC-A3, SEC-A4, SEC-A5 and the
  budget_used part of SEC-A7. Idempotent: every policy is dropped before it is created.

  1. public.users
     - SELECT no longer granted to `anon` (the roster, emails and roles were readable with the
       anon key). Signed-in users still read the roster (chat, tasks and calendar pickers).
     - INSERT policy removed. Onboarding is an admin insert with the service role, and
       handle_new_user() is SECURITY DEFINER, so neither needs a policy.

  2. public.activity_logs
     - A BEFORE INSERT trigger stamps user_id and user_role from auth.uid(), so the client can
       no longer attribute a log row to someone else. Service-role inserts (auth.uid() is NULL)
       keep the values they send.
     - INSERT requires a public.users row for the caller.

  3. storage bucket chat-attachments
     - Made private. SELECT and INSERT are limited to participants of the conversation named by
       the first path segment. The broken DELETE policy (compared the conversation folder with
       auth.uid()) is dropped; there is no delete in the UI.
     - The client now stores the object path and signs URLs on read. Messages written before this
       migration store the old public URL; the client extracts the path from it.

  4. Blanket USING (true) policies that made the role policies on the same tables ineffective
     (permissive policies are OR-ed). Resulting matrix:

     | Table(s)                                             | Read           | Write                          | Delete                         |
     |------------------------------------------------------|----------------|--------------------------------|--------------------------------|
     | apartments, buildings, garages, repositories,        | authenticated  | Director, Sales, Accounting    | Director, Sales                |
     |   apartment_garages, apartment_repositories          |                | (links: + delete by the same)  | (links: Director, Sales, Acc.) |
     | customers, sales                                     | authenticated  | Director, Sales, Accounting    | Director (existing policy)     |
     | banks                                                | authenticated  | Director, Accounting, Investment (existing) | Director (existing) |
     | credit_allocations                                   | authenticated  | Director, Accounting, Investment (existing) | Director (existing) |
     | monthly_budgets, hidden_approved_invoices            | Director, Accounting | Director, Accounting    | Director, Accounting           |
     | project_milestones                                   | authenticated  | Director; Supervision on assigned projects | same              |
     | document_categories                                  | authenticated  | Director                       | Director                       |
     | documents                                            | authenticated  | insert: authenticated; update: uploader, Director, Accounting | uploader, Director, Accounting |
     | document_associations                                | authenticated  | insert: authenticated          | document uploader, Director, Accounting |
     | subcontractor_comments                               | authenticated  | insert: own user_id; update: author, Director | author, Director |
     | subcontractor_milestones                             | authenticated  | Director, Supervision, Accounting | Director, Supervision, Accounting |

  5. project_phases.budget_used is maintained by a trigger on contracts instead of a client-side
     UPDATE that RLS silently dropped for Accounting users.
*/

-- ---------------------------------------------------------------------------
-- Helper: the caller's role from public.users (NULL when there is no row)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT role FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.app_user_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.app_user_role() TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. public.users
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow reading users for authentication" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
CREATE POLICY "Authenticated users can read users" ON public.users
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert users" ON public.users;

-- ---------------------------------------------------------------------------
-- 2. public.activity_logs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stamp_activity_log_actor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_id uuid;
  v_role text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT id, role INTO v_id, v_role FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
    IF FOUND THEN
      NEW.user_id := v_id;
      NEW.user_role := v_role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_activity_log_actor ON public.activity_logs;
CREATE TRIGGER trg_stamp_activity_log_actor
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_activity_log_actor();

DROP POLICY IF EXISTS "Authenticated users can insert activity_logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert activity_logs" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.auth_user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. storage bucket chat-attachments
-- ---------------------------------------------------------------------------

-- True when the caller participates in the conversation named by the object's first folder.
CREATE OR REPLACE FUNCTION public.can_access_chat_object(p_name text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_conversation uuid;
  v_user uuid;
BEGIN
  BEGIN
    v_conversation := (storage.foldername(p_name))[1]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  SELECT id INTO v_user FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_user IS NULL OR v_conversation IS NULL THEN
    RETURN false;
  END IF;
  RETURN public.is_chat_participant(v_conversation, v_user);
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_chat_object(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_chat_object(text) TO authenticated;

UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat attachments"                 ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat attachments"      ON storage.objects;
DROP POLICY IF EXISTS "Chat participants can upload chat attachments"    ON storage.objects;
DROP POLICY IF EXISTS "Chat participants can view chat attachments"      ON storage.objects;

CREATE POLICY "Chat participants can upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND public.can_access_chat_object(name));

CREATE POLICY "Chat participants can view chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND public.can_access_chat_object(name));

-- ---------------------------------------------------------------------------
-- 4. Replace blanket policies
-- ---------------------------------------------------------------------------

-- 4a. Sales inventory: apartments, buildings, garages, repositories
DROP POLICY IF EXISTS "Authenticated users can access apartments" ON public.apartments;
DROP POLICY IF EXISTS "Allow authenticated to insert buildings"   ON public.buildings;
DROP POLICY IF EXISTS "Allow authenticated to update buildings"   ON public.buildings;
DROP POLICY IF EXISTS "Allow authenticated to delete buildings"   ON public.buildings;
DROP POLICY IF EXISTS "Allow authenticated to insert garages"     ON public.garages;
DROP POLICY IF EXISTS "Allow authenticated to update garages"     ON public.garages;
DROP POLICY IF EXISTS "Allow authenticated to delete garages"     ON public.garages;
DROP POLICY IF EXISTS "Allow authenticated to insert repositories" ON public.repositories;
DROP POLICY IF EXISTS "Allow authenticated to update repositories" ON public.repositories;
DROP POLICY IF EXISTS "Allow authenticated to delete repositories" ON public.repositories;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['apartments', 'buildings', 'garages', 'repositories'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can view %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Sales roles can insert %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Sales roles can update %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Sales roles can delete %1$s" ON public.%1$I', t);

    EXECUTE format('CREATE POLICY "Authenticated users can view %1$s" ON public.%1$I
      FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Sales roles can insert %1$s" ON public.%1$I
      FOR INSERT TO authenticated
      WITH CHECK (public.app_user_role() = ANY (ARRAY[''Director'', ''Sales'', ''Accounting'']))', t);
    EXECUTE format('CREATE POLICY "Sales roles can update %1$s" ON public.%1$I
      FOR UPDATE TO authenticated
      USING (public.app_user_role() = ANY (ARRAY[''Director'', ''Sales'', ''Accounting'']))
      WITH CHECK (public.app_user_role() = ANY (ARRAY[''Director'', ''Sales'', ''Accounting'']))', t);
    EXECUTE format('CREATE POLICY "Sales roles can delete %1$s" ON public.%1$I
      FOR DELETE TO authenticated
      USING (public.app_user_role() = ANY (ARRAY[''Director'', ''Sales'']))', t);
  END LOOP;
END $$;

-- 4b. Package links: apartment_garages, apartment_repositories
DO $$
DECLARE
  t text;
  label text;
BEGIN
  FOREACH t IN ARRAY ARRAY['apartment_garages', 'apartment_repositories'] LOOP
    label := replace(t, '_', ' ');
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can insert %s" ON public.%I', label, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can update %s" ON public.%I', label, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can delete %s" ON public.%I', label, t);
    EXECUTE format('DROP POLICY IF EXISTS "Sales roles can write %s" ON public.%I', label, t);

    EXECUTE format('CREATE POLICY "Sales roles can write %s" ON public.%I
      FOR ALL TO authenticated
      USING (public.app_user_role() = ANY (ARRAY[''Director'', ''Sales'', ''Accounting'']))
      WITH CHECK (public.app_user_role() = ANY (ARRAY[''Director'', ''Sales'', ''Accounting'']))', label, t);
  END LOOP;
END $$;

-- 4c. customers, sales: keep the existing role policies, drop the blanket FOR ALL
DROP POLICY IF EXISTS "Authenticated users can access customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers"   ON public.customers;
CREATE POLICY "Authenticated users can view customers" ON public.customers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can access sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can view sales"   ON public.sales;
CREATE POLICY "Authenticated users can view sales" ON public.sales
  FOR SELECT TO authenticated USING (true);

-- 4d. banks: keep finance write and Director delete policies
DROP POLICY IF EXISTS "Authenticated users can access banks" ON public.banks;
DROP POLICY IF EXISTS "Authenticated users can view banks"   ON public.banks;
CREATE POLICY "Authenticated users can view banks" ON public.banks
  FOR SELECT TO authenticated USING (true);

-- 4e. credit_allocations: keep finance write and Director delete policies
DROP POLICY IF EXISTS "Authenticated users can create credit allocations" ON public.credit_allocations;
DROP POLICY IF EXISTS "Authenticated users can update credit allocations" ON public.credit_allocations;
DROP POLICY IF EXISTS "Authenticated users can delete credit allocations" ON public.credit_allocations;

-- 4f. monthly_budgets, hidden_approved_invoices: finance only
DROP POLICY IF EXISTS "Authenticated users can view budgets"   ON public.monthly_budgets;
DROP POLICY IF EXISTS "Authenticated users can insert budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Authenticated users can update budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Authenticated users can delete budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Finance roles can manage budgets"       ON public.monthly_budgets;
CREATE POLICY "Finance roles can manage budgets" ON public.monthly_budgets
  FOR ALL TO authenticated
  USING (public.app_user_role() = ANY (ARRAY['Director', 'Accounting']))
  WITH CHECK (public.app_user_role() = ANY (ARRAY['Director', 'Accounting']));

DROP POLICY IF EXISTS "Authenticated users can view hidden invoices" ON public.hidden_approved_invoices;
DROP POLICY IF EXISTS "Authenticated users can hide invoices"        ON public.hidden_approved_invoices;
DROP POLICY IF EXISTS "Authenticated users can unhide invoices"      ON public.hidden_approved_invoices;
DROP POLICY IF EXISTS "Finance roles can manage hidden invoices"     ON public.hidden_approved_invoices;
CREATE POLICY "Finance roles can manage hidden invoices" ON public.hidden_approved_invoices
  FOR ALL TO authenticated
  USING (public.app_user_role() = ANY (ARRAY['Director', 'Accounting']))
  WITH CHECK (public.app_user_role() = ANY (ARRAY['Director', 'Accounting']));

-- 4g. project_milestones (also DEFECT_BACKLOG GEN-4)
DROP POLICY IF EXISTS "Authenticated users can access project milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Authenticated users can view project milestones"   ON public.project_milestones;
DROP POLICY IF EXISTS "Project managers can manage project milestones"    ON public.project_milestones;
CREATE POLICY "Authenticated users can view project milestones" ON public.project_milestones
  FOR SELECT TO authenticated USING (true);
-- user_has_project_access(uuid) is true for Directors and for Supervision on assigned projects.
CREATE POLICY "Project managers can manage project milestones" ON public.project_milestones
  FOR ALL TO authenticated
  USING (public.user_has_project_access(project_id))
  WITH CHECK (public.user_has_project_access(project_id));

-- 4h. document_categories: Director writes
DROP POLICY IF EXISTS "Authenticated users can insert document_categories" ON public.document_categories;
DROP POLICY IF EXISTS "Authenticated users can update document_categories" ON public.document_categories;
DROP POLICY IF EXISTS "Authenticated users can delete document_categories" ON public.document_categories;
DROP POLICY IF EXISTS "Director can manage document_categories"            ON public.document_categories;
CREATE POLICY "Director can manage document_categories" ON public.document_categories
  FOR ALL TO authenticated
  USING (public.app_user_role() = 'Director')
  WITH CHECK (public.app_user_role() = 'Director');

-- 4i. documents, document_associations: uploader or finance roles may change or delete
DROP POLICY IF EXISTS "Authenticated users can update documents"     ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can delete documents"     ON public.documents;
DROP POLICY IF EXISTS "Uploader or finance can update documents"     ON public.documents;
DROP POLICY IF EXISTS "Uploader or finance can delete documents"     ON public.documents;
CREATE POLICY "Uploader or finance can update documents" ON public.documents
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.app_user_role() = ANY (ARRAY['Director', 'Accounting']))
  WITH CHECK (uploaded_by = auth.uid() OR public.app_user_role() = ANY (ARRAY['Director', 'Accounting']));
CREATE POLICY "Uploader or finance can delete documents" ON public.documents
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.app_user_role() = ANY (ARRAY['Director', 'Accounting']));

DROP POLICY IF EXISTS "Authenticated users can delete document_associations" ON public.document_associations;
DROP POLICY IF EXISTS "Uploader or finance can delete document_associations" ON public.document_associations;
CREATE POLICY "Uploader or finance can delete document_associations" ON public.document_associations
  FOR DELETE TO authenticated
  USING (
    public.app_user_role() = ANY (ARRAY['Director', 'Accounting'])
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_associations.document_id AND d.uploaded_by = auth.uid()
    )
  );

-- 4j. subcontractor_comments: authors own their comments
DROP POLICY IF EXISTS "Authenticated users can insert subcontractor comments" ON public.subcontractor_comments;
DROP POLICY IF EXISTS "Allow authenticated to update subcontractor_comments"  ON public.subcontractor_comments;
DROP POLICY IF EXISTS "Allow authenticated to delete subcontractor_comments"  ON public.subcontractor_comments;
DROP POLICY IF EXISTS "Users can insert own subcontractor comments"           ON public.subcontractor_comments;
DROP POLICY IF EXISTS "Authors can update subcontractor comments"             ON public.subcontractor_comments;
DROP POLICY IF EXISTS "Authors can delete subcontractor comments"             ON public.subcontractor_comments;
CREATE POLICY "Users can insert own subcontractor comments" ON public.subcontractor_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));
CREATE POLICY "Authors can update subcontractor comments" ON public.subcontractor_comments
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
    OR public.app_user_role() = 'Director'
  );
CREATE POLICY "Authors can delete subcontractor comments" ON public.subcontractor_comments
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
    OR public.app_user_role() = 'Director'
  );

-- 4k. subcontractor_milestones: same writers as contracts
DROP POLICY IF EXISTS "Authenticated users can insert milestones" ON public.subcontractor_milestones;
DROP POLICY IF EXISTS "Authenticated users can update milestones" ON public.subcontractor_milestones;
DROP POLICY IF EXISTS "Authenticated users can delete milestones" ON public.subcontractor_milestones;
DROP POLICY IF EXISTS "Site roles can manage milestones"          ON public.subcontractor_milestones;
CREATE POLICY "Site roles can manage milestones" ON public.subcontractor_milestones
  FOR ALL TO authenticated
  USING (public.app_user_role() = ANY (ARRAY['Director', 'Supervision', 'Accounting']))
  WITH CHECK (public.app_user_role() = ANY (ARRAY['Director', 'Supervision', 'Accounting']));

-- ---------------------------------------------------------------------------
-- 5. project_phases.budget_used maintained by the database
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalculate_phase_budget_used(p_phase_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  UPDATE public.project_phases p
  SET budget_used = COALESCE((
    SELECT SUM(c.contract_amount)
    FROM public.contracts c
    WHERE c.phase_id = p.id
      AND c.status IN ('draft', 'active')
  ), 0)
  WHERE p.id = p_phase_id
    AND p.budget_used IS DISTINCT FROM COALESCE((
      SELECT SUM(c.contract_amount)
      FROM public.contracts c
      WHERE c.phase_id = p.id
        AND c.status IN ('draft', 'active')
    ), 0);
$$;

REVOKE ALL ON FUNCTION public.recalculate_phase_budget_used(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_phase_budget_used_from_contract() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.phase_id IS NOT NULL THEN
    PERFORM public.recalculate_phase_budget_used(OLD.phase_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.phase_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.phase_id IS DISTINCT FROM OLD.phase_id
          OR NEW.contract_amount IS DISTINCT FROM OLD.contract_amount
          OR NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM public.recalculate_phase_budget_used(NEW.phase_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_phase_budget_used ON public.contracts;
CREATE TRIGGER trg_sync_phase_budget_used
  AFTER INSERT OR DELETE OR UPDATE OF phase_id, contract_amount, status ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.sync_phase_budget_used_from_contract();
