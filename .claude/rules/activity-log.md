---
paths:
  - "src/**/services/**"
  - "src/components/**/hooks/**"
  - "src/lib/**"
  - "src/contexts/**"
  - "src/components/General/ActivityLog/**"
---

# Activity Log

Every mutation (create, update, delete, bulk, import, export) must be logged via `logActivity()`
from `src/lib/activityLog.ts`. This is a fire-and-forget call that never blocks the user's
operation. It also clears the dashboard/report cache (`useCachedData`), so logged mutations are
what keep dashboards fresh.

1. **Always add logging** — after every successful `supabase.from().insert/update/delete`, add a `logActivity()` call
2. **Action naming** — format is `entity.verb` (e.g. `invoice.create`, `apartment.bulk_price_update`). Use the table name (singular) as the entity prefix
3. **Capture entity IDs** — for inserts, chain `.select('id').maybeSingle()` to capture the new ID and pass it as `entityId`
4. **Severity levels** — `low` for reads/links, `medium` for standard creates/updates, `high` for deletes/financial/bulk/imports
5. **Metadata conventions** — creates include `entity_name`, updates include `changed_fields: Object.keys(updates)`, deletes include `entity_name` when available, bulk ops include `count`
6. **Never use `.catch()` on Supabase builder** — it returns `PromiseLike`, not `Promise`. Use async/await with try/catch
7. **Register entity routes** — add new entities to `ENTITY_ROUTE_MAP` in `src/components/General/ActivityLog/types.ts`
8. **Add i18n keys** — add action labels under `activity_log.actions` in both locale files

Full documentation: [`docs/ACTIVITY_LOG.md`](../../docs/ACTIVITY_LOG.md)
