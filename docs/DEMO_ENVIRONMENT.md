# Cognilion — Demo environment

The showcase instance: a full Cognilion deployment carrying a fabricated Croatian
dataset, so the product can be demonstrated without a single row of customer data
ever appearing on screen.

| | |
|---|---|
| Supabase project | **LandmarkDemo** — `asvuyvmuzroyrzlgyzij` (West EU / Ireland) |
| Supabase org | `hcnbogcacutbyjqcbsio` — **free tier**, shared with LandmarkDev |
| Dataset | [`scripts/seed-demo-data.mjs`](../scripts/seed-demo-data.mjs) |
| Logins | [`scripts/seed-demo-users.mjs`](../scripts/seed-demo-users.mjs) |

## Why a separate project at all

The schema has **no tenant dimension** — no `organization_id`, no `tenant_id`,
nowhere in 350 migrations. RLS is role-scoped, not tenant-scoped: most policies are
`USING (true)` for any authenticated user, the rest check `public.users.role`. There
is therefore no way to give an account on production a slice of the data. A demo
Director on prod sees every real invoice, credit line and bank balance, and the
Cashflow password is not a second line of defence — it ships in the JS bundle.

Beyond RLS, a demo account on production would also appear in every employee's chat
picker ([`fetchAllUsers()`](../src/components/Chat/services/chatService.ts) selects
`users` unfiltered), land demo tasks in the shared mobile task app, fire real push
notifications at real staff, and write demo activity into the real audit trail.

So: a separate database is not a nicety here, it is the only mechanism available.

---

## First-time setup

Steps 1–6 are one-time. Step 7 is what you re-run whenever the demo data goes stale.

### 1. Point the CLI at the demo project

`supabase db push` has **no `--project-ref` flag** — it pushes to whatever
`supabase/.temp/project-ref` currently names. Link deliberately:

```bash
supabase link --project-ref asvuyvmuzroyrzlgyzij
cat supabase/.temp/project-ref   # must print asvuyvmuzroyrzlgyzij
```

> ⚠️ **Relink to LandmarkDev when you are done** (step 8). A stray `db push` or
> `npm run db:types` in the wrong link state is how migrations have reached the
> wrong database before.

### 2. Apply the schema

```bash
supabase db push --linked --yes
```

All 350 migrations replay cleanly onto a virgin database. This also creates the
Storage buckets (`documents`, `contract-documents`, `task-attachments`,
`chat-attachments`, `ai-chat-attachments`) and seeds the `cost_classifications`
lookup, both of which the data seeder depends on.

Do **not** run `e2e/support/anchor-setup.sql` — that is E2E fixture data and has no
place in a demo. Do **not** apply anything from `supabase/parked-migrations/erp/`;
the ERP integration is on hold and its screens are flag-hidden anyway.

### 3. Collect the keys

```bash
supabase projects api-keys --project-ref asvuyvmuzroyrzlgyzij --output json
```

Take `anon` and `service_role`. The codebase expects the legacy JWT keys, not the
newer `sb_publishable_*` / `sb_secret_*` pair.

### 4. Write a demo env file

Keep it separate from `.env` so the dev project stays the default target:

```bash
# .env.demo  (already gitignored by the `.env.*` rule)
VITE_SUPABASE_URL=https://asvuyvmuzroyrzlgyzij.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
VITE_CASHFLOW_PASSWORD=demo
ANTHROPIC_API_KEY=<key>          # only needed for the AI chat / document sorting
```

Both seed scripts allowlist `asvuyvmuzroyrzlgyzij` and `nxvbglegqcgxlxvyfuht` and
refuse every other project ref, production included.

### 5. Create the demo logins

```bash
node --env-file=.env.demo scripts/seed-demo-users.mjs
```

Five accounts, one per role, password `cognilion-demo` unless you set
`DEMO_USER_PASSWORD`:

| Role | Email | Name shown in the app |
|---|---|---|
| Director | `direktor@adriatic-demo.hr` | Ivan Kovačević |
| Accounting | `racunovodstvo@adriatic-demo.hr` | Ana Novak |
| Sales | `prodaja@adriatic-demo.hr` | Marina Babić |
| Supervision | `nadzor@adriatic-demo.hr` | Petar Jurić |
| Investment | `investicije@adriatic-demo.hr` | Luka Marasović |

The script is idempotent, so run it again any time; it only repairs the
`public.users` mapping for accounts that already exist. It must run **before** the
data seeder, which reads `public.users` for `created_by`, `project_managers` and
task assignees and aborts on an empty roster.

### 6. Deploy the edge functions (optional, per feature demoed)

```bash
supabase secrets set --project-ref asvuyvmuzroyrzlgyzij ANTHROPIC_API_KEY=<key>
supabase functions deploy ai-chat --project-ref asvuyvmuzroyrzlgyzij
```

| Function | Needed for | Secrets |
|---|---|---|
| `ai-chat` | the floating AI assistant | `ANTHROPIC_API_KEY` |
| `sort-document` | live emailed-document classification | `ANTHROPIC_API_KEY`, `DOC_SORT_WEBHOOK_SECRET` |
| `send-push` | push notifications | VAPID keys (`vapid.json`) |
| `dispatch-calendar-reminders` | reminder toasts | needs a cron schedule |
| `import-erp` | **do not deploy** — ERP work is on hold | — |

Skipping all of them still leaves a complete app: only those four features degrade.

### 7. Seed the dataset

```bash
node --env-file=.env.demo scripts/seed-demo-data.mjs
```

Wipes every business table and inserts the demo dataset across General, Supervision,
Sales, Cashflow, Funding, Retail, Tasks, Documents, Chat and Calendar. Users,
`document_categories` and `cost_classifications` survive. Derived values (invoice
status, contract realizacija, account balances) are left to the database triggers,
so the numbers reconcile the way they would in real use.

Re-run it before any demo — Chat and Calendar are anchored to the **real current
week**, so a dataset seeded a month ago opens on a calendar full of history and
nothing upcoming.

### 8. Relink the CLI to dev

```bash
supabase link --project-ref nxvbglegqcgxlxvyfuht
```

Do not skip this. See the warning in step 1.

---

## Frontend deployment

The app is a static Vite build (`vercel.json` is an SPA rewrite plus asset caching)
and **only three variables reach the browser**:

```
VITE_SUPABASE_URL=https://asvuyvmuzroyrzlgyzij.supabase.co
VITE_SUPABASE_ANON_KEY=<the demo anon key, in .env.demo>
VITE_CASHFLOW_PASSWORD=<whatever you want to type on stage>
```

Never add the service-role key. Nothing in the bundle uses it, and a `VITE_`-prefixed
secret is a published secret.

There are two ways to host this, and they differ in one respect that matters.

### Option A — a branch in the existing Vercel project

Vercel scopes environment variables per environment, and Preview variables can be
scoped to a single Git branch. So: a `demo` branch, the three variables scoped to
**Preview → `demo`**, and Vercel serves it on a stable branch alias (a subdomain can
be attached to the branch too).

Cheaper to run, and one setting away from being wrong — see the warning below.

Consider scoping the variables to **Preview generally** rather than to the `demo`
branch alone. Every feature-branch preview then talks to fabricated data instead of
whatever it reaches today, which is strictly safer.

### Option B — a separate Vercel project

A second project on the same repository. The two projects share no variable list, so
the failure below cannot happen.

Settings that matter:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Production Branch | `demo` — a branch you fast-forward deliberately |
| Environment Variables | the three `VITE_` vars, scoped to **Production** |

Because this project's "production" *is* the demo, the variables go in the Production
scope. Nothing here should ever carry a production-database value.

Deployments trigger on every push to the Production Branch. To redeploy without a new
commit, use Deployments → ⋯ → Redeploy in the dashboard.

> ⚠️ **Variables are read at build time, not run time.** Vite inlines
> `import.meta.env.VITE_*` into the bundle ([`src/lib/supabase.ts`](../src/lib/supabase.ts)),
> so a variable added *after* a deploy changes nothing until a rebuild — and a
> "Redeploy" that reuses the build cache can serve the stale bundle. Redeploy with
> **"Use existing Build Cache" unchecked**, or push a commit.

To check a build locally before pushing, `npx vite build --mode demo` picks up
`.env.demo`; grepping `dist/assets` for `asvuyvmuzroyrzlgyzij` confirms which database
got baked in, and the service-role key must not appear anywhere in the output.

### ⚠️ The failure mode that matters

With a single project, demo and production variables live in one list separated by a
dropdown. Two ways that goes wrong:

- a variable left on *All Environments* points **production at the demo database** —
  embarrassing, harmless;
- the demo branch falls through to Production values and the demo renders **real
  customer financials** — the exact outcome this environment exists to prevent.

**Verify after the first deploy.** The demo accounts exist only on LandmarkDemo, so
open the deployed URL and sign in as `direktor@adriatic-demo.hr`:

- login succeeds → the build is pointed at the demo database, correct;
- "invalid credentials" → it picked up production's Supabase variables. Fix the
  scoping before showing it to anyone.

The check fails closed, needs no tooling, and takes ten seconds.

### Either way

Pin the deployment to a branch you fast-forward deliberately. A demo branch that
tracks `development` will change what is on screen when someone merges.

Also check Vercel's **Deployment Protection**: preview deployments sit behind Vercel
Authentication, which is invisible while you are logged in and a wall for anyone you
send the link to.

---

## Operational notes

**The project pauses.** Free-tier Supabase projects pause after ~7 days without
activity, and this one gets no CI traffic to keep it warm. A demo booked after a
quiet fortnight will open on a dead database. Either wake it from the dashboard the
day before, or move the project to the paid org.

**Microsoft sign-in is always rendered.** The "Sign in with Microsoft" button on the
login form is unconditional, and Azure is not configured on the demo project —
clicking it errors. Either configure the Azure provider for the demo project or
brief whoever drives the demo to use email and password.

**What the seeded state looks like on open.** The Director account lands with 2
unread chat messages and 1 pending calendar invitation, so the header badges are
populated rather than empty. Documents are real PDFs in Storage and open when
clicked; two of them carry `source = 'email_import'` with a classification note,
which is the emailed-document story told with data instead of slides.

**Adding data by hand is fine, but it is not durable.** The next reseed wipes it.
Anything that should survive belongs in `scripts/seed-demo-data.mjs`.

---

## Related

- [`TESTING.md`](./TESTING.md#seeding-helpers) — the other seeding helpers, and how the E2E fixtures differ
- [`EMAIL_DOCUMENT_SORTING.md`](./EMAIL_DOCUMENT_SORTING.md) — the pipeline the two `email_import` documents imitate
- [`PRESENTATION_MODULES.md`](./PRESENTATION_MODULES.md) — the per-module talking points this environment exists to support
