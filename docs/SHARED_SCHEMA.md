# The shared task schema

**Audience:** whoever is working in the standalone mobile task app. That app and Cognilion
point at **one production database**. This file is the description of what is actually in it,
so you can verify an implementation against reality instead of against migration files.

**Cognilion owns this schema.** Migrations are authored in the Cognilion repo
(`supabase/migrations/`) and applied by hand. The mobile repo's own `supabase/migrations/`
have never all been applied — see [§10](#10-known-fictions) — so do not treat them as a
description of the database. Cognilion keeps stale reference copies of a few of them under
`todoMigrations/`; those must **never** be run against this database (its `handle_new_user`
would clobber Cognilion's).

Everything below was read out of the migration files in this repo on 2026-09-03. Where a
statement is inferred rather than read, it says so.

### ⚠️ Applied vs. pending

This file describes the schema **as the migrations define it**, which is not the same as what
is running right now. Check this table before you rely on anything below.

| Surface | Status |
|---|---|
| §1–3, §5–9 (tasks, assignees, comments, attachments, reminders, profiles, push) | **Applied.** In production. |
| §4 `task_subtasks`, and `p_subtasks` on both RPCs | **PENDING.** `20260902110000_task_subtasks.sql` is written but has **not been applied to any database**, not even dev. |

A section describing a pending migration is a specification, not an observation. Do not read
"Added `<migration>`" as "already in the database" — migrations here are applied by hand, and
this repo carries them for a while before anyone runs them.

**If you are the mobile app: do not ship a bundle that names `task_subtasks` yet.** Your
`TASK_SELECT` embeds it, so until the migration is applied your whole workspace query fails
and every screen goes dark. Cognilion fans out one query per relation and degrades quietly, so
it will look fine while your app is broken. Ask before you deploy; the answer today is "not
yet".

---

## 1. Identity model — the thing most bugs come from

Every user column in every task table holds an **auth user id** (`auth.users.id`), and every
one of them FKs to `public.profiles`, not to `public.users`.

```
auth.users.id ──> public.profiles.id          <- task tables point here
                        ▲
                        │ mirrored by trigger (email), owned by profiles (name, role)
                        │
              public.users.auth_user_id
              public.users.id               <- Cognilion's own domain tables point here
```

`public.users` is Cognilion's own user table and is **irrelevant to you** except that it is
where profiles get mirrored from. If you see a query joining `users`, it is Cognilion code.

```sql
CREATE TABLE public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text NOT NULL,
  role       text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- `email` is trigger-synced from `public.users`. `name` and `role` are **owned by profiles** —
  task-app admins are managed there explicitly and are independent of Cognilion's five roles
  (`Director` / `Accounting` / `Sales` / `Supervision` / `Investment`).
- New signups default to `role='user'`.
- Policies: `profiles_select_all` (any authenticated user may read any profile).
  `profiles_update_own` was **dropped** — regular users can no longer update their own row,
  which is what closes self-promotion through the unrestricted `role` column. Admins may
  update any profile (`20260721110000_profiles_admin_role_management.sql`).
- ⚠️ Since `20260825100000_sso_pre_provisioned_only.sql`, a non-email auth provider
  (Microsoft/Entra) **links only, never auto-provisions**. An OAuth identity with no
  pre-existing roster row gets no `public.users` row, and Cognilion's client then refuses the
  session. If the mobile app ever adds OAuth sign-in, this is the behaviour it inherits.

---

## 2. `public.tasks`

```sql
-- current shape, after baseline + 20260706120000 + 20260720120000 + 20260813090000
CREATE TABLE public.tasks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              text NOT NULL,
  description        text NOT NULL DEFAULT ''::text,
  created_by         uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  deadline           date NULL,                      -- renamed from due_date
  due_time           time without time zone NULL,
  is_private         boolean NOT NULL DEFAULT false,
  completed          boolean NOT NULL DEFAULT false, -- replaced the status enum
  completed_at       timestamptz NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  project_id         uuid NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  description_format text NOT NULL DEFAULT 'markdown'::text,
  color              text NULL,
  CONSTRAINT tasks_description_format_check CHECK (description_format IN ('markdown','plain')),
  CONSTRAINT tasks_color_check CHECK (color IN ('blue','green','yellow','red','purple','gray'))
);
```

Gone for good: `status`, `priority`, `reminder_offsets`, and the `task_reminder_sends` table
(all dropped in `20260706120000_simplify_tasks.sql` / `20260720120000_tasks_mobile_compat.sql`).

**Columns the mobile app does not know about, and must not clobber:**

| Column | Why it matters to you |
|---|---|
| `is_private` | A whole visibility dimension. Any policy or query you write that ignores it is a leak — see [§6](#6-rls-policy-matrix) |
| `updated_at` | **NOT NULL, and there is no trigger.** Every writer sets it by hand. A write path that omits it leaves the column lying |
| `due_time` | Legacy Calendar rendering in Cognilion. No UI anywhere. Leave it alone |
| `description_format` | Cognilion renders legacy `markdown` rows through a markdown view and saves all new descriptions as `plain`. If you rewrite a description, do not assume it is plain text |
| `color` | Six values, closed set — see [§11](#11-things-that-must-change-in-lockstep) |

⚠️ **`created_by` is NULLABLE** and `ON DELETE SET NULL`. A task whose creator was deleted has
`created_by IS NULL`, which means it is nobody's to edit under the creator branch of every
policy below. Handle the null.

⚠️ **`project_id` is NULLABLE here**, a deliberate deviation from the mobile DDL. Cognilion's
quick-add creates tasks with no project.

⚠️ **There are no triggers on `tasks`.** `completed_at` and `updated_at` are entirely
client-maintained. The only thing that writes them server-side is the subtask trigger in
[§4](#4-publictask_subtasks--checklists).

---

## 3. `public.task_assignees`

```sql
CREATE TABLE public.task_assignees (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),  -- surrogate, UNIQUE not PK
  task_id        uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  assignee_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, assignee_id),
  CONSTRAINT task_assignees_id_key UNIQUE (id)
);
CREATE INDEX idx_task_assignees_assignee ON public.task_assignees(assignee_id);
```

⚠️ **The composite PK is load-bearing, in two directions.** PostgREST only detects a table as
an m2m junction — enabling the flat embed `assignees:profiles!task_assignees` that both your
client and the `send-push` edge function rely on — when both FK columns form the PK. The
surrogate `id` was kept as UNIQUE because Cognilion deletes assignee rows by id. Do not
"tidy" either of them.

`acknowledged_at` is Cognilion's unread-badge bookkeeping (cleared when a user opens
`/tasks`). It is invisible to your app but **must survive a reassignment** — which is why the
update RPC diffs the assignee set instead of wipe-and-reinsert.

---

## 4. `public.task_subtasks` — checklists

Specified by `20260902110000_task_subtasks.sql`, which is **not yet applied** — see the
applied-vs-pending table above. This is the newest surface and the one you are most likely to
be verifying, so verify against the migration file, and expect the database not to have it.

```sql
CREATE TABLE public.task_subtasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title        text NOT NULL CHECK (btrim(title) <> ''),
  position     int  NOT NULL,
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_subtasks_task ON public.task_subtasks(task_id, position);
```

**The kind is derived, never stored.** Zero subtasks = simple task; one or more = checklist.
There is no `kind` column and there must not be one: it would be a second source of truth that
can drift from the rows it describes, and every read site would then have to decide which of
the two to believe.

**The index is deliberately not UNIQUE on `(task_id, position)`.** A reorder rewrites every
position in one statement, and a unique constraint would reject the intermediate state unless
it were DEFERRABLE. Two rows can therefore briefly share a position — **sort by
`(position, created_at)`**, not `position` alone.

### The trigger

```sql
CREATE TRIGGER task_subtasks_sync_parent
  AFTER INSERT OR UPDATE OF completed OR DELETE ON public.task_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_completion_from_subtasks();
```

`sync_task_completion_from_subtasks()` is `SECURITY DEFINER`, and:

- branches on `TG_OP` to pick `OLD.task_id` vs `NEW.task_id` — outside its own operation each
  of `NEW`/`OLD` is an *unassigned* record, not a null one, so `coalesce(NEW.task_id,
  OLD.task_id)` raises `record "new" is not assigned yet` on a DELETE;
- returns early if the parent row is gone (a cascade from `tasks` fires it once per subtask
  after the parent is deleted);
- returns early if the task has **zero** subtasks — the task is simple again and whatever
  `completed` was is what the user last chose. It is not reset;
- otherwise sets `completed = true, completed_at = now(), updated_at = now()` when no line is
  open, or `completed = false, completed_at = NULL, updated_at = now()` when one is;
- **guards both arms on the value actually changing**, so re-ticking an already-complete
  checklist never churns `completed_at`.

⚠️ **There is no `updated_at` on `task_subtasks`, and the parent's only moves on a crossing.**
The trigger guards both arms on `completed` actually changing, so ticking a middle line
(3/6 → 4/6) writes nothing to `tasks` at all. Between the two facts, **no column anywhere
records a tick that did not close its task**, so nothing here can drive incremental sync — use
realtime on `task_subtasks` (Cognilion does) or refetch. A hand-maintained `updated_at` was
deliberately not added: it would need a trigger to be reliable, and an untriggered one would
reproduce exactly the "every writer must remember" problem this file keeps warning about on
`tasks`. If incremental sync is ever needed, add the column **and** its trigger together.

### Consequences you must implement on the client

1. **The parent checkbox is a readout, not a control.** Render it disabled on a checklist task
   everywhere one appears. Leaving it live wires two switches to one lamp: the write sticks,
   and the next subtask tick silently reverts it. Cognilion disables it in three places
   (list row, detail drawer, calendar pill) and re-checks server-side as a backstop.
2. **The `task_completed` push is client-fired.** No trigger calls `send-push`. If a tick
   completes the parent, *your code* has to notice — re-read the task after the write and
   notify only on a genuine open → done crossing. Re-opening must never notify.
3. **Reopening re-arms the deadline reminder.** See [§9](#9-push-notifications-and-deadline-reminders).

---

## 5. `task_comments`, `task_attachments`, `task_reminders`, `push_subscriptions`

```sql
CREATE TABLE public.task_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,          -- auth id, -> profiles
  comment    text NOT NULL,
  created_at timestamptz DEFAULT now(),        -- nullable, unlike updated_at
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.task_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by  uuid NOT NULL,        -- auth id, -> profiles
  storage_path text NOT NULL,
  file_name    text NOT NULL,
  mime_type    text,
  size_bytes   bigint NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.task_reminders (          -- scheduler bookkeeping, no client reads it
  task_id    uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('day_before','due_today','overdue')),
  sent_on    date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, kind, sent_on)
);
-- REVOKE ALL ON public.task_reminders FROM anon, authenticated;

CREATE TABLE public.push_subscriptions (
  endpoint   text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

`task_comments.comment` bodies may embed `@[username](uuid)` mention tokens — Cognilion's
format. If you render comments, either parse those or you will show raw tokens.

Attachments live in the **private `task-attachments` Storage bucket**; Cognilion enforces
25 MB per file and 10 per task on the client only (there is no server-side cap). Storage has
its own `TaskAttachments storage: read` / `: delete` policies keyed on `bucket_id` and
task visibility.

`push_subscriptions` is written **only** through `save_push_subscription(...)`; the table's
own policies are select-own and delete-own. There is no INSERT policy, by design.

---

## 6. RLS policy matrix

RLS is enabled on every table above. Helpers, all `SECURITY DEFINER` with
`SET search_path = public` so a child table's policy can consult `tasks` without recursing
through its RLS:

| Helper | Returns |
|---|---|
| `public.is_admin()` | `profiles.role = 'admin'` for `auth.uid()` (also `STABLE`) |
| `public.get_task_creator(p_task_id)` | `tasks.created_by` |
| `public.is_task_assignee(p_task_id, p_user_id)` | exists in `task_assignees` |
| `public.can_view_task(p_task_id, p_user_id)` | `NOT is_private OR created_by = user OR is_task_assignee(...)` |

All policies are `TO authenticated` and compare `auth.uid()` directly — there is no `users`
subquery anywhere in the task policies.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `tasks` | `NOT is_private` OR creator OR assignee | `created_by = auth.uid() OR created_by IS NULL` | creator OR assignee OR admin | creator OR admin |
| `task_assignees` | `can_view_task(...)` | creator OR admin | **self only**, and only to set `acknowledged_at` | creator OR admin |
| `task_subtasks` | `can_view_task(...)` | creator OR assignee OR admin | creator OR assignee OR admin | creator OR assignee OR admin |
| `task_comments` | `can_view_task(...)` | author, and author must be assignee or creator | author | author |
| `task_attachments` | `can_view_task(...)` | uploader, and uploader must be assignee or creator | — | uploader OR task creator |
| `task_reminders` | — (`REVOKE ALL`) | — | — | — |
| `push_subscriptions` | own | — (RPC only) | — | own |
| `profiles` | all | — | admin only | — |

Three things worth reading twice:

- **`task_subtasks` SELECT goes through `can_view_task()`, not `USING (true)`.** The mobile
  reference spec used `USING (true)`, which is correct in a schema with no `is_private`. Here
  it would have published every private task's checklist titles to every authenticated user.
- **`task_subtasks` writes are open to assignees**, not just the creator — wider than
  `task_assignees` on purpose. Who is *on* a task stays the creator's call; what the work
  consists of does not, and Cognilion's drawer already lets an assignee edit the title,
  description, deadline, project and colour.
- **`tasks` UPDATE is creator OR assignee OR admin**, which is wider than the update RPC's own
  rule (creator or admin). That is not a contradiction: the RPC is `SECURITY DEFINER` and
  carries its own check, deliberately narrower than the row policy that governs direct writes.

---

## 7. Privileges — what is *not* locked down, and why

**There are no column-level grants on any task table.** Supabase's stock role grants stand and
the row policies above are the entire boundary.

This is a deliberate, documented refusal of the mobile repo's pattern. That repo's
`20260812091000_task_edit.sql` narrows `tasks`:

```sql
REVOKE UPDATE ON public.tasks FROM authenticated;
GRANT  UPDATE (completed, completed_at) ON public.tasks TO authenticated;
```

**That was never applied and must not be.** Cognilion's task detail drawer autosaves every
field with a direct PATCH — title, description, project, deadline, `is_private`, and
`updated_at` on every save including the completion toggle — so the narrowed grant would break
the editor *and* the toggle with `permission denied for table tasks`. The reasoning is in the
header of `20260813091000_task_edit_rpc.sql`. The same argument was applied again to
`task_subtasks` in `20260902110000`.

Practical consequence for you: **"the only direct write a client can make is the tick" is not
true of this database.** If your code or comments assume it, they are describing a database
that does not exist. Your client is still free to route structural edits through the RPCs —
nothing forces you to write directly — but the invariant is not enforced underneath you.

Function grants that *do* exist:

```sql
REVOKE EXECUTE ... FROM public;  GRANT EXECUTE ... TO authenticated;
  -- create_task_with_assignees(text,text,uuid,date,uuid[],text,jsonb)
  -- update_task_with_assignees(uuid,text,text,uuid,date,text,uuid[],jsonb)
  -- save_push_subscription(text,text,text,text)
REVOKE EXECUTE ON FUNCTION public.dispatch_due_reminders(boolean) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_task_completion_from_subtasks() FROM public;
```

---

## 8. The RPCs — exact contracts

⚠️ **Argument names and order are the contract.** PostgREST resolves overloads by *named*
arguments, so renaming or reordering one breaks your client with an overload-resolution
error, not a clear message. New arguments go **last, with a DEFAULT**, so a browser running
the old bundle keeps working through a deploy.

```sql
create_task_with_assignees(
  p_title        text,
  p_description  text,
  p_project_id   uuid,
  p_deadline     date,
  p_assignee_ids uuid[],
  p_color        text  DEFAULT NULL,
  p_subtasks     jsonb DEFAULT NULL
) RETURNS uuid   -- SECURITY INVOKER

update_task_with_assignees(
  p_task_id      uuid,
  p_title        text,
  p_description  text,
  p_project_id   uuid,
  p_deadline     date,
  p_color        text,
  p_assignee_ids uuid[],
  p_subtasks     jsonb DEFAULT NULL
) RETURNS uuid   -- SECURITY DEFINER
```

⚠️ **The two argument orders disagree on purpose.** In `create`, `p_assignee_ids` comes before
`p_color`; in `update`, after. This is historical and frozen. Pass named arguments and it does
not matter; build a positional call and it will.

Behaviour worth knowing:

- Both **require at least one assignee** and raise `Zadatak mora imati barem jednog zaduženog.`
  otherwise. The Croatian error strings are surfaced to users — treat them as part of the
  contract.
- `update` is `SECURITY DEFINER`, so it carries its own authorisation check and raises
  `Zadatak može urediti samo osoba koja ga je stvorila ili admin.` It also takes
  `SELECT ... FOR UPDATE` on the task first, so two people editing from two phones serialise
  rather than racing through the assignee diff.
- `update` **does not touch** `completed`, `completed_at`, `is_private`, `due_time` or
  `description_format`. An edit through the RPC preserves all five.
- `update` **does set `updated_at = now()`.** The mobile reference version of this function
  omits that line — its `tasks` has no such column. Any future recreation of this function
  must keep it.
- ⚠️ **`p_description` erases on null, it does not preserve.** The body is
  `description = coalesce(p_description, '')`, so omitting the argument blanks the column
  rather than leaving it. Any edit path must send the current description back, even when the
  user did not touch it — a form that only collects subtasks will silently wipe the prose
  above them. This has been the behaviour since `20260813091000` and is deliberately not being
  changed: it is live, and quietly flipping it to "null means keep" would break callers that
  rely on being able to clear a description.
- Assignees reconcile as a set difference (drop who left, add who arrived), so unchanged rows
  keep their `created_at` **and their `acknowledged_at`**.

### `p_subtasks` — the tri-state

A jsonb array of `{"id": uuid|null, "title": text, "position": int}`. Three distinguishable
states, and the client is expected to use all three:

| Value | Meaning |
|---|---|
| `NULL` | "I don't know about subtasks" — an older client bundle. Leave them alone. |
| `'[]'` | "This is a simple task." Clear the list. |
| `[…]` | This is the list, in this order. |

A present `id` means "the row you already have" and **preserves its `completed`**; `id: null`
means a new line. That is the entire reason `update` reconciles rather than delete-and-reinsert
— without it, changing a task's deadline would silently un-tick every line somebody had
crossed off. Blank titles are dropped rather than rejected (an empty trailing row is what an
"add line" button produces). Positions fall back to array ordinal when absent.

The reconciliation is one statement with three CTE arms — `removed` (anti-join, because
`NOT IN` would swallow the predicate on a NULL id), `moved` (title/position only, never
`completed`), and the insert. It is deliberately **not** a temp table: `pg_temp` is searched
ahead of a `SECURITY DEFINER` function's fixed `search_path`, so a temp relation name is one
an unprivileged session can get in front of.

---

## 9. Push notifications and deadline reminders

### `send-push` edge function

`POST /functions/v1/send-push` with `{ event, taskId, newAssigneeIds? }`.

| Event | Who may send | Recipients |
|---|---|---|
| `task_assigned` | signed-in user | assignees (caller excluded) |
| `task_completed` | signed-in user | assignees + creator |
| `reminder_day_before` / `reminder_due_today` | scheduler only | assignees |
| `reminder_overdue` | scheduler only | assignees + creator |

- The two sets are **cross-gated against caller mode** (`isReminder !== (mode === "scheduled")`
  → 403). Without that, any signed-in user could POST `reminder_overdue` and buzz the whole
  crew.
- Auth is either the `x-reminder-secret` header (mode `scheduled`) or a signed-in JWT (mode
  `user`); in user mode the caller must be an assignee, the creator, or an admin.
- **The client sends only a task id.** The function re-reads the task with the service role and
  works recipients out server-side, so the fan-out cannot be widened from outside.
  `newAssigneeIds` may only *narrow* the set, by intersection.
- Reminders are skipped server-side if the task is already completed.
- Notification `tag` is `task.id` for user events and `${task.id}:reminder` for reminders, with
  a 32-char RFC 8030 Topic — so a reminder cannot collapse onto an unread "Novi zadatak".
- Bodies are built **in Croatian, server-side**. Cognilion is bilingual; these are not.

### `dispatch_due_reminders(p_force boolean DEFAULT false)`

Scheduled hourly by `pg_cron`, gated on the Europe/Zagreb hour (07–09 unless forced, wide
because repeat runs are free and turn 08:00 into a catch-up). Claims work with
`INSERT ... ON CONFLICT DO NOTHING RETURNING` against `task_reminders`, then `net.http_post`s
each one. `pg_net` queues after commit, so the claim and the send share a transaction: a
reminder can be lost, never duplicated, and the overdue kind heals itself next morning.

The predicate is:

```sql
WHERE t.completed = false
  AND t.deadline IS NOT NULL
  AND t.deadline <= v_today + 1
  AND t.deadline >= v_today - 30   -- stop nagging about ancient tasks
```

⚠️ **It is re-evaluated every run.** A checklist task pushed back to open by an un-tick becomes
eligible again the following morning — un-ticking a line on a late task re-arms its overdue
nag. Nothing re-sends within a day; the PK `(task_id, kind, sent_on)` *is* the once-per-day
rule. This is also why Cognilion's one-shot subtask backfill skips completed tasks: converting
them would reopen them in bulk and push about work finished months ago.

Secrets live in Vault (`send_push_url`, `send_push_service_key`, `reminder_secret`) and the
function raises rather than silently burning a day's reminders if any is missing.

---

## 10. Known fictions

Things that are written down somewhere but are **not** true of this database:

1. **The mobile repo's `supabase/migrations/`.** `20260812091000_task_edit.sql` narrows the
   column grants on `tasks`; that was never applied. Cognilion's drawer PATCHes every field
   directly and would be dead in production if it had been. Cheap confirmation: save a title
   from Cognilion's task drawer — if it works, the lockdown is absent.
2. **Cognilion's `todoMigrations/`.** A stale reference mirror of the mobile app's migrations,
   five files deep and missing the `20260812*` trio entirely. Reference only, never run.
3. **Any `full_schema.sql` snapshot.** Cognilion had one; it rotted and became actively
   misleading. The baseline migration plus the ordered migrations are the trustworthy record.
   Do not hand-maintain a schema dump — this file describes *contracts and divergences*,
   which change rarely, precisely so it does not rot the same way.
4. **The subtasks reference spec** (`docs/subtasks-schema.sql` in the mobile repo, if it is
   still there). It differs from what was applied in three ways: no column lockdown, SELECT
   through `can_view_task()`, and assignee-writable subtasks. Delete it or point it here.

---

## 11. Things that must change in lockstep

| Change | Every place it has to land |
|---|---|
| A task colour | `tasks_color_check` (Cognilion migration), `COLOR_STYLES` in Cognilion's `taskColor.ts`, `src/lib/taskColor.ts` in the mobile app. It cannot be a free hex string: Tailwind emits classes by scanning sources for literals, so `bg-${color}-100` is never generated |
| An RPC argument | Both clients, same name and position, appended last with a DEFAULT |
| A new column on a task table | Nothing, today — but if the column grants are ever narrowed, every new column needs its own GRANT or its own RPC |
| A new task table | Both clients' read paths, and consider the deploy-order asymmetry below |

---

## 12. Change protocol

1. **Author the migration in the Cognilion repo only.** Timestamped
   `YYYYMMDDHHMMSS_snake_case.sql`, with a `/* … */` header explaining the rationale and every
   deviation from whatever it mirrors. Nothing is applied automatically; a human runs it.
2. **Apply to the e2e/dev project first** (`nxvbglegqcgxlxvyfuht`, pinned as
   `E2E_ALLOWED_SUPABASE_URL` in Cognilion's `.env.test.example`), then production. Handover
   SQL written against the *other* app's assumptions has been wrong three times out of three
   so far; dev is where it should first meet a real Postgres.
3. **Regenerate types** — `npm run db:types` in Cognilion (writes `src/types/database.ts` and
   copies it to `supabase/functions/_shared/database.ts`), and whatever the equivalent is on
   your side.
4. **Schema first, then clients — and mind the asymmetry.** Your client reads tasks with a
   single `TASK_SELECT` embed, so a missing table fails the whole workspace query and the app
   goes dark. Cognilion fans out one query per relation, so it degrades to "feature missing"
   and keeps working. It is entirely possible to apply a migration, see Cognilion fine, and
   not notice that your app is the one holding the gun. Never ship a bundle that names a table
   before the table exists.
5. **One-shot data operations are not migrations.** Cognilion keeps them in `docs/` as a
   read-only preview plus an explicit `BEGIN/COMMIT` write, run by hand after reading the
   preview's output — see `docs/subtasks-backfill-preview.sql`.

---

## 13. Verification checklist

Run against a dev database, as two different users (a task creator and an assignee), plus a
third uninvolved user.

**Schema**

- [ ] `task_subtasks` exists with the columns in [§4](#4-publictask_subtasks--checklists) and a
      **non-unique** index on `(task_id, position)`
- [ ] Both RPCs accept `p_subtasks` as the **last** argument and still work when it is omitted
- [ ] `update_task_with_assignees` sets `updated_at = now()`
- [ ] `\d+ public.tasks` shows **no triggers**; `\d+ public.task_subtasks` shows
      `task_subtasks_sync_parent`
- [ ] No column-level grants: `\dp public.tasks` and `\dp public.task_subtasks` show no
      per-column entries for `authenticated`

**Behaviour**

- [ ] Tick every line → parent flips to done server-side, `completed_at` **and** `updated_at`
      set, exactly one `task_completed` push to assignees + creator
- [ ] Tick the **last two** lines as fast as you can → still exactly **one** push. Two
      overlapping ticks that both observe the crossing is the easy way to send two
- [ ] Un-tick one → parent reopens, `completed_at` cleared, **no** push
- [ ] Re-tick the last line on an already-complete checklist → `completed_at` unchanged
- [ ] Edit the task's deadline through the RPC → **every tick survives** (id reconciliation)
- [ ] Send `p_subtasks: null` → subtasks untouched; send `[]` → list cleared
- [ ] Delete the task → subtasks cascade, no trigger error
- [ ] Remove every line → the task is simple again and its own checkbox re-enables; its
      `completed` is **not** reset by the trigger
- [ ] As the **assignee**: tick, rename, reorder and remove a line — all four succeed. A
      `permission denied for table task_subtasks` here means a narrow grant leaked in
- [ ] As an **uninvolved third user**: a private task's subtasks are invisible. Titles leaking
      here means the SELECT policy reverted to `USING (true)`
- [ ] The parent checkbox is disabled on a checklist task in every view that renders one

---

## 14. Client parity

Two clients, one database. The schema stops a client doing the wrong thing; it does not stop
two clients doing *different right things*. These are the behaviours that must match, because
a user moving between the apps sees the same rows.

| Behaviour | The rule both clients implement |
|---|---|
| Subtask ordering | Sort by `(position, created_at)`. The index is not unique, so `position` alone is not a stable order |
| Task kind | Derived: zero subtasks = simple, one or more = checklist. Never stored, never cached on the task row |
| Parent checkbox | Disabled on a checklist task in **every** view that renders one. It is a readout |
| Completion push | `task_completed` fired **client-side**, only on a genuine open → done crossing, established by re-reading the parent after the write. Never on reopen |
| Ticking a line | A direct two-column write of `completed` / `completed_at` on `task_subtasks`. Do **not** also write `tasks.updated_at` — the trigger owns it |
| Any direct write to `tasks` | Must set `updated_at = now()` by hand. There is no trigger |
| Who may add / rename / reorder / remove a line | **Creator, assignee, or admin** — the set the RLS policies allow. A client that is stricter than this is inconsistent with the other one, not "safer" |
| Removing the last line | The task becomes simple again and **keeps** whatever `completed` it had. Do not reset it |
| Blank line titles | Dropped silently, not rejected. An empty trailing row is what an "add line" button produces |
| Concurrent ticks | The UI must not block: tick optimistically, do not gate the next tap on the last one's response. But the **write path must serialise per task**, or two ticks on a 4-of-6 list both read `completed = false` before writing and `true` after, each concludes it closed the task, and the user gets two pushes. Queue the network work behind the optimistic UI; do not serialise the taps |

⚠️ The permission row is the one that has actually diverged. Routing structural subtask edits
through `update_task_with_assignees` looks safe but is not equivalent: that function is
`SECURITY DEFINER` and raises for anyone who is not the creator or an admin, so an assignee
who can rename a line in one app cannot in the other. A client that wants the RPC for
task-level edits still needs a **separate direct-write path for subtask structure**.

### Known open divergences

Recorded rather than fixed. Decide these deliberately, don't let them drift further.

1. **Who may edit a task** (title, deadline, project, assignees — not subtasks). Cognilion's
   row policy and drawer allow creator **or assignee**; the mobile app routes through
   `update_task_with_assignees`, which is creator-or-admin. This predates subtasks and is a
   real product disagreement about whether an assignee owns the work or only reports on it.
2. **Legacy `markdown` descriptions.** Cognilion renders them; the mobile app has no markdown
   renderer and shows the syntax raw. `description_format` says which a row is.
3. **Authoring lines at create time.** The mobile app's create form can author subtasks;
   Cognilion's create modal cannot — you make the task, then add lines in the drawer, the same
   way attachments work. A deliberate scope choice, not an oversight. Both apps agree on the
   result, only on how many steps it takes.
