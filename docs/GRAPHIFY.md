# graphify knowledge graph

The repo has a graphify knowledge graph at `graphify-out/` (gitignored). It indexes **code only**
— about 2,250 nodes over about 700 files as of October 2026 — so doc or migration edits never
require a rebuild. CLAUDE.md carries the short version of this page.

## Keeping it current

- The `post-commit` and `post-checkout` git hooks (installed by `graphify hook install`) rebuild
  the code graph after every commit and branch switch.
- To query uncommitted changes, rebuild by hand (about 5 seconds):
  `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
  Run it from the repo root: run elsewhere it writes a stray `graphify-out/` into that directory
  (`src/graphify-out/` and `supabase/functions/graphify-out/` are leftovers of exactly that; they
  are gitignored and safe to delete).
- `.graphifyignore` at the repo root controls what gets indexed. graphify does **not** read
  `.gitignore`, so anything gitignored that still contains parseable source has to be listed there.
- Use the graph to find *where* something lives and which files import which. Verify anything it
  claims about relationships against the code before acting on it.

## The one edge type worth trusting

`imports_from` edges between two files whose names are **unique in the repo** are accurate — all 898
such edges checked out against the source (September 2026). That subset is what module-coupling or
fan-in questions should be answered from. Everything else below is unreliable in a specific way.

Read direction from `_src` / `_tgt`, **not** `source` / `target`: the graph is serialised undirected,
and `source`/`target` are swapped on about a fifth of edges.

## What this graph cannot tell you

Extraction is pure AST with no model in the loop (`0 input · 0 output` tokens), and node IDs are
built from **filename stem + symbol name with no path**. The consequences, all load-bearing (figures
measured in September 2026):

- **Cross-file `calls` edges are all false.** Only 4 of ~360 `calls` edges cross a file boundary
  and every one comes from a merged same-named symbol — these are exactly the report's *"Surprising
  Connections"* (e.g. `Tasks/index.tsx`'s `confirmDelete()` → `refreshCounts()` in
  `Documents/index.tsx`, a string `Tasks/index.tsx` does not contain). Call edges describe
  **within-file** structure only; treat that report section as noise.
- **Same-named files collide into one node, and the merged node becomes a fake hub.** The two most
  connected nodes in the graph are artifacts: `index` (358 edges — all 46 `index.ts(x)` files
  folded onto `supabase/functions/send-push/index.ts`) and `types` (156 edges — 22 `types.ts`
  files folded onto `Supervision/Subcontractors/types.ts`). They are what the report's Community 0
  and 1 are built around. The losing files get no file node — 45 `src/components` files are
  absent this way — so **a file's absence from the graph means nothing**.
- **Collisions also misroute imports.** e2e specs importing `./support/auth` show as importing
  `supabase/functions/_shared/auth.ts`; frontend imports of `types/database` land on the
  `_shared/database.ts` mirror.
- **Barrel imports vanish.** `src/components/ui/index.ts` lost its collision, so the ~180
  `from '../ui'` imports are not edges. Fan-in for shared UI components is badly undercounted.
- **Edge functions have no internal import edges.** Deno specifiers carry the extension
  (`'../_shared/cors.ts'`), which the resolver does not match; `supabase/functions/*` look
  mutually isolated when they are not.
- **No inbound import ≠ dead code.** Of 45 `src` file nodes with zero inbound imports, only 7 were
  actually unreferenced — the rest were tests or reached through barrels, lazy `import()` or a
  collided name. Before deleting anything, grep every exported symbol, not just the file path.

The *God Nodes* list ranks **symbol** nodes only (file nodes are excluded), by raw edge count, so it
surfaces short common helper names rather than core abstractions — `str()`, a local coercion helper
in `import-erp/feeds.ts`, topped it in September 2026. The real shared core by fan-in is
`lib/supabase.ts`, `contexts/ToastContext.tsx`, `lib/activityLog.ts`, `contexts/AuthContext.tsx`,
`types/tasks.ts`. Community cohesion scores of 0.01–0.05 mean the clustering found little structure
there; they are not a signal that a module needs splitting.

None of this is configurable — `path.stem` is hardcoded in graphify's extractor. Do not patch
`site-packages` to work around it.

## Stale files in graphify-out/

Only `graph.json`, `GRAPH_REPORT.md` and `cache/` are refreshed by the rebuilds above.
`graph.html`, `manifest.json` and `cost.json` are left at whatever the last full `graphify` run
produced (April 2026, 369 files) — **do not read them as current**.
