---
paths:
  - "supabase/migrations/**"
  - "src/components/Tasks/**"
  - "todoMigrations/**"
---

# Shared tasks schema

The `tasks` tables are **shared with a standalone mobile task app** that points at the same
production database. This repo owns that schema. Before changing any `task*` table, RPC or
policy, read [`docs/SHARED_SCHEMA.md`](../../docs/SHARED_SCHEMA.md) — it records the contracts
both clients depend on and the assumptions the other app gets wrong.

Never run anything in `todoMigrations/` against this database.
