---
name: db-types
description: Regenerate src/types/database.ts from the linked Supabase project, checking first which project the CLI is linked to and restoring the ERP types afterwards.
disable-model-invocation: true
---

# Regenerate database types

Linked project ref: !`cat supabase/.temp/project-ref 2>/dev/null || echo "not linked"`

1. **Name the linked project to the user and wait for a yes.** The link is often left on the
   demo project, and the production ref is not in the repo. Ask which project the types should
   come from if the user has not said. Never re-link without being asked.
2. Run `npm run db:types`. It writes `src/types/database.ts` and copies it to
   `supabase/functions/_shared/database.ts`.
3. **Restore the ERP types.** While the ERP integration is on hold no project has the `erp`
   schema, so the generated file has no `erp:` blocks. `import-erp` still needs them. Take the
   `erp:` block inside `Database` and the `erp:` block inside `Constants` from
   `git show HEAD:src/types/database.ts`, put them back in both files, and keep everything else
   from the new output.
4. `git diff --stat` both files, then `npm run typecheck`. Summarise what changed in `public`
   (tables, columns, functions added or removed).
