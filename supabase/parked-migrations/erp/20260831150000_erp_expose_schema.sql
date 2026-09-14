/*
  # Expose the `erp` schema to PostgREST

  The importer writes to `erp` with the service role, and `supabase-js`
  reaches it through `.schema('erp')` — which goes via PostgREST. Until the
  schema is on PostgREST's list every such call fails with
  `Invalid schema: erp` / `PGRST106`, service role included: the restriction is
  in the API layer, not the database, so bypassing RLS does not bypass it.

  ## Why exposing it is safe

  Every table in `erp` has RLS enabled with a SELECT-only policy for Director
  and Accounting, and **no INSERT/UPDATE/DELETE policy at all** (phases 0-2),
  apart from the three mapping tables the Šifrarnici screen owns. `anon` holds
  no grants in this schema, so it gets 42501 rather than data.

  Exposure therefore changes one thing: Director and Accounting can now read
  staging and code lists directly, which is what the import screen needs in
  order to show what landed and what failed. It does not create a write path.

  ## Alternatives considered

  Writing through `public` views instead would have kept the schema hidden, but
  `ON CONFLICT` does not work through a view, so the reference upserts would
  have had to become delete-then-insert with no unique-constraint safety net.
  SECURITY DEFINER RPCs would have meant six functions duplicating what
  PostgREST already does. Neither buys real security given the RLS above.

  ## Production

  `ALTER ROLE authenticator` persists, but Supabase's dashboard also has an
  "Exposed schemas" setting (Settings ▸ API) that can overwrite it. When this
  reaches production, set it there as well, or an infrastructure change may
  silently revert the API to `public` only and every import will start failing
  with PGRST106.
*/

DO $$
DECLARE
  current_schemas text;
BEGIN
  SELECT COALESCE(
    (SELECT SPLIT_PART(s, '=', 2)
       FROM UNNEST(COALESCE(rolconfig, ARRAY[]::text[])) AS s
      WHERE s LIKE 'pgrst.db_schemas=%'
      LIMIT 1),
    'public, graphql_public'
  )
  INTO current_schemas
  FROM pg_roles
  WHERE rolname = 'authenticator';

  IF current_schemas NOT LIKE '%erp%' THEN
    EXECUTE format(
      'ALTER ROLE authenticator SET pgrst.db_schemas = %L',
      current_schemas || ', erp'
    );
    RAISE NOTICE 'pgrst.db_schemas is now: %', current_schemas || ', erp';
  ELSE
    RAISE NOTICE 'erp already exposed: %', current_schemas;
  END IF;
END $$;

-- PostgREST caches both the config and the schema; without these it keeps
-- serving the old list until the next restart.
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
