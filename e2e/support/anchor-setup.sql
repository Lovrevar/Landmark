-- E2E public-schema anchor data. Idempotent; safe to re-run.
--
-- Usage: paste into the Supabase SQL editor for the DEV project, or:
--   psql "$SUPABASE_DB_URL" -f e2e/support/anchor-setup.sql
--
-- NOTE on test users: the E2E auth users (the 5 role users + the dedicated
-- e2e-logout@mail.com used by auth/session.spec) are provisioned automatically by
-- the Playwright globalSetup via the Supabase Admin API (idempotent, version-safe),
-- not here. Raw auth.users seeding via SQL is GoTrue-version-sensitive and was
-- unreliable, so it was removed. After a dev-DB reset, the users re-create
-- themselves on the next `npm run test:e2e`; run this file too (any time) for the
-- anchor project + project_managers link below, which the Supervision/Funding/
-- Retail tests depend on.

BEGIN;

-- 1. Anchor project. Supervision, Funding, and Retail tests attach work under this.
INSERT INTO projects (name, location, start_date, status, budget)
SELECT 'E2E Anchor Project', 'E2E', CURRENT_DATE, 'In Progress', 0
WHERE NOT EXISTS (
  SELECT 1 FROM projects WHERE name = 'E2E Anchor Project'
);

-- 2. Link the Supervision test user to the anchor project via project_managers so
--    the user's assignedProjects check in AuthContext returns a non-empty list.
--    (Populates once the Supervision user exists — i.e. after globalSetup has run;
--    re-run this file if you applied it before the first suite run.)
INSERT INTO project_managers (user_id, project_id)
SELECT u.id, p.id
FROM users u
CROSS JOIN projects p
WHERE u.email = 'e2e-supervision@mail.com'
  AND p.name = 'E2E Anchor Project'
  AND NOT EXISTS (
    SELECT 1 FROM project_managers pm
    WHERE pm.user_id = u.id AND pm.project_id = p.id
  );

COMMIT;

-- Optional anchors — enable only if the corresponding module's tests reveal they
-- are needed. Leave commented until the first failure shows the reference is missing.

-- INSERT INTO banks (name, total_credit_limit, outstanding_debt, available_funds, interest_rate, notes)
-- SELECT 'E2E Anchor Bank', 0, 0, 0, 0, 'E2E'
-- WHERE NOT EXISTS (SELECT 1 FROM banks WHERE name = 'E2E Anchor Bank');

-- INSERT INTO retail_suppliers (name)
-- SELECT 'E2E Anchor Supplier'
-- WHERE NOT EXISTS (SELECT 1 FROM retail_suppliers WHERE name = 'E2E Anchor Supplier');

-- INSERT INTO retail_customers (name)
-- SELECT 'E2E Anchor Customer'
-- WHERE NOT EXISTS (SELECT 1 FROM retail_customers WHERE name = 'E2E Anchor Customer');
