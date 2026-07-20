/*
# Core schema for Construction Task Manager

## Purpose
Multi-user Croatian construction task manager. Two roles: admin + regular.
Admins manage projects + users; everyone creates/assigns tasks and marks own done.

## New Tables
- `profiles` — extends auth.users with name + role.
  - `id` uuid PK, matches auth.users(id), ON DELETE CASCADE.
  - `email` text (denormalized for easy listing).
  - `name` text NOT NULL (display name shown across UI).
  - `role` text NOT NULL, CHECK in ('admin','user'), default 'user'.
  - `created_at` timestamptz default now().
- `projects` — construction sites (Zagreb, Osijek, Split...).
  - `id` uuid PK.
  - `name` text NOT NULL.
  - `created_at` timestamptz default now().
- `tasks` — the work items.
  - `id` uuid PK.
  - `description` text NOT NULL.
  - `project_id` uuid FK -> projects(id) ON DELETE CASCADE.
  - `assignee_id` uuid FK -> auth.users(id) ON DELETE CASCADE.
  - `deadline` date NULL (optional).
  - `completed` boolean NOT NULL default false.
  - `completed_at` timestamptz NULL.
  - `created_by` uuid FK -> auth.users(id) ON DELETE SET NULL.
  - `created_at` timestamptz default now().

## Security — RLS enabled on all tables
- `profiles`: every authenticated user READs all profiles. Users UPDATE only their own row. INSERT/DELETE only via the manage-users edge function (service role bypasses RLS).
- `projects`: READ for all authenticated. WRITE only for admins via is_admin().
- `tasks`: READ for all authenticated. INSERT for all authenticated. UPDATE for the assignee OR an admin. DELETE admin-only.

## Helper
- `is_admin()` — returns true if current user's profile role = 'admin'. SECURITY DEFINER, STABLE, fixed search_path. Created AFTER the profiles table so it can query it.

## Notes
1. `assignee_id` references `auth.users` directly (auth owns that table; profiles is a public mirror).
2. Tasks are shared team artifacts — access is role-based, not owner-based.
3. `profiles` rows are created by the manage-users edge function (service role). A trigger also auto-creates a 'user' profile on direct signup (defensive).
*/

-- ---------- tables first (helper + policies reference them) ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assignee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deadline date,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- helper: is_admin() ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ---------- indexes ----------
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);

-- ---------- RLS: profiles ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- RLS: projects ----------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_all" ON public.projects;
CREATE POLICY "projects_select_all"
  ON public.projects FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "projects_insert_admin" ON public.projects;
CREATE POLICY "projects_insert_admin"
  ON public.projects FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "projects_update_admin" ON public.projects;
CREATE POLICY "projects_update_admin"
  ON public.projects FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "projects_delete_admin" ON public.projects;
CREATE POLICY "projects_delete_admin"
  ON public.projects FOR DELETE
  TO authenticated USING (public.is_admin());

-- ---------- RLS: tasks ----------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
CREATE POLICY "tasks_select_all"
  ON public.tasks FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "tasks_insert_all" ON public.tasks;
CREATE POLICY "tasks_insert_all"
  ON public.tasks FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tasks_update_all" ON public.tasks;
CREATE POLICY "tasks_update_all"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR auth.uid() = assignee_id)
  WITH CHECK (public.is_admin() OR auth.uid() = assignee_id);

DROP POLICY IF EXISTS "tasks_delete_admin" ON public.tasks;
CREATE POLICY "tasks_delete_admin"
  ON public.tasks FOR DELETE
  TO authenticated USING (public.is_admin());

-- ---------- auto-profile on signup (defensive) ----------
-- Normal Supabase email signup creates an auth.users row but NOT a profiles row.
-- The admin invite flow (edge function) creates both. This trigger covers direct
-- signup: it creates a 'user' role profile, using name from metadata if present.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
