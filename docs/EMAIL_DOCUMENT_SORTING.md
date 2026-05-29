# Email Document Sorting — Architecture & Operations

This document is the maintenance reference for the automatic email document-sorting
feature. Staff forward documents (invoices, contracts, permits, bank statements) to a
dedicated mailbox; the system classifies each attachment with the Claude API and files
it into the existing Documents module — no manual upload, no manual categorisation.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Make.com Scenario](#makecom-scenario)
- [Edge Function: `sort-document`](#edge-function-sort-document)
- [Classification Logic](#classification-logic)
- [Duplicate Detection](#duplicate-detection)
- [Data Model](#data-model)
- [Documents Module UI](#documents-module-ui)
- [Configuration & Secrets](#configuration--secrets)
- [Error Handling](#error-handling)
- [Deployment](#deployment)
- [Verification](#verification)
- [Known Limitations](#known-limitations)

---

## Overview

A document forwarded to the `documents@…` mailbox ends up — fully classified — on the
Documents page, with zero human steps in between. The pipeline is:

1. **Make.com** watches the mailbox, extracts PDF/image attachments, and POSTs each one
   (plus the email subject/body) to a Supabase edge function.
2. The **`sort-document`** edge function authenticates the caller, deduplicates, calls
   the **Claude API** to classify the document, and writes it into the existing
   `documents` / `document_associations` tables and the `documents` storage bucket.
3. The document appears on the **Documents page** under its assigned category, linked
   to the relevant projects / suppliers / contracts.

Confirmed behaviour (from the requirements gathering):

- **Sort depth:** category **and** entity links — Claude reads the content and matches
  real projects, suppliers, contracts, units, etc.
- **Low confidence:** the document is still stored, but with `category_id = null`, so it
  stays in the **All documents** view and is tallied into the **Uncategorized** count
  (there is no dedicated Uncategorized filter node); Claude's best-guess reasoning is
  saved in the `description` field.
- **Email scope:** only PDF/image attachments are processed; the email subject + body
  are always passed to Claude as extra classification context.
- **Notifications:** none — documents simply appear on the Documents page.

The feature reuses the Documents data model wholesale and adds no frontend code. It
follows the edge-function conventions established by `ai-chat` (see
[AI_CHAT.md](./AI_CHAT.md)).

---

## Architecture

```
Email → documents@…
        │
        ▼
┌─────────────────────┐
│  Make.com scenario  │  Watch emails → Iterator(attachments)
│                     │  → Filter(PDF/image) → HTTP POST
└──────────┬──────────┘
           │  POST /functions/v1/sort-document   (one request per attachment)
           ▼
┌──────────────────────────────────────────────┐
│  sort-document edge function                  │
│  1. validate shared secret + attachment       │
│  2. SHA-256 dedup check → skip if seen         │
│  3. classify via Claude API (two passes)       │
│  4. upload to `documents` bucket               │
│  5. insert documents + document_associations   │
└──────────┬─────────────────────────────────────┘
           ▼
   Documents page (existing UI) — categorised & linked
```

Each attachment is an independent POST, so one bad file never affects its siblings, and
each Claude call is isolated.

---

## Make.com Scenario

One scenario, modules in order:

1. **Watch emails** — IMAP or Gmail module bound to the `documents@…` mailbox, INBOX
   folder. Set "mark as read" after processing and a small batch size (~5) so a backlog
   doesn't fire a huge burst.
2. **Iterator** — bound to the trigger's `Attachments[]` array; one cycle per
   attachment, exposing `fileName`, `contentType`, and binary `data`.
3. **Filter** — placed on the route after the Iterator. Keep only `contentType` in
   `application/pdf, image/png, image/jpeg, image/jpg, image/webp`. Everything else
   (inline signatures, `.docx`, `.zip`) is silently dropped.
4. **HTTP "Make a request"** — one POST per kept attachment:
   - **URL:** `https://<project-ref>.supabase.co/functions/v1/sort-document`
   - **Method:** `POST`
   - **Headers:**
     - `Content-Type: application/json`
     - `x-doc-sort-secret: <shared secret>` — store via a Make.com connection/data
       store, not inline.
     - `apikey: <SUPABASE_ANON_KEY>` — the Supabase gateway requires *some* apikey even
       when `verify_jwt = false`; the anon key carries no privilege here.
   - **Body type:** Raw / JSON. Base64-encode the binary with Make's `base64()`:
     ```json
     {
       "email_subject": "{{trigger.subject}}",
       "email_body": "{{trigger.text}}",
       "email_from": "{{trigger.from}}",
       "email_message_id": "{{trigger.messageId}}",
       "attachment": {
         "file_name": "{{iterator.fileName}}",
         "mime_type": "{{iterator.contentType}}",
         "data_base64": "{{base64(iterator.data)}}"
       }
     }
     ```
   - **Timeout:** 120 s — PDF classification can take 10–40 s.
   - Attach an **error handler** with the **Resume** directive so a single 4xx/5xx
     doesn't halt the scenario.

**Why one attachment per POST:** keeps each request small (one base64 blob), isolates
failures, and makes each Claude call independent. An email with N attachments fans out
into N POSTs via the Iterator; the subject/body is carried as a constant on every POST.

---

## Edge Function: `sort-document`

Source: [`supabase/functions/sort-document/`](../supabase/functions/sort-document/)
— `index.ts` (HTTP, auth, storage, DB) and `classifier.ts` (Claude + entity matching).

### Authentication — why no JWT

The caller is a machine (Make.com), so there is no Supabase user session and no user
JWT. `config.toml` therefore sets `verify_jwt = false` for this function, and the
function authenticates the caller itself: it reads the `x-doc-sort-secret` header and
compares it — in constant time — against the `DOC_SORT_WEBHOOK_SECRET` env var. A
mismatch returns `401`. The standard `_shared/auth.ts` `authenticate()` helper is
deliberately **not** used — it requires a user JWT.

The function builds a single **service-role** Supabase client (RLS-bypassing); there is
no RLS-scoped client and no `uploaded_by` — that column is inserted as `null`.

### Request flow

1. `handlePreflight(req)` — early return on OPTIONS.
2. Non-POST → `405`.
3. Validate `x-doc-sort-secret` → `401` on mismatch.
4. Parse + validate the JSON body → `400` on malformed input.
5. Validate the attachment: MIME whitelist (`415` if not), base64 decode (`400` if
   corrupt), decoded size ≤ 50 MB (`413` if over — the `documents` bucket cap).
6. **Duplicate check** (see below) → `200 { duplicate: true }` and stop, if seen.
7. Classify via Claude.
8. Upload to the `documents` bucket; insert `documents` + `document_associations`.
9. Return `200 { document_id, duplicate: false, category_id, confidence, associations_count }`.

### Response policy

- `200` on every successful import — including the uncategorized fallback (still a
  success) and a duplicate skip.
- `4xx` only for genuinely rejectable input (bad secret, bad body, unsupported or
  oversized file).
- `5xx` for Claude / storage / DB failures, so Make.com's error handler can log/retry.
  On any failure after the storage upload, the function rolls back (removes the
  orphaned storage object, and the `documents` row if it was inserted).

---

## Classification Logic

Implemented in [`classifier.ts`](../supabase/functions/sort-document/classifier.ts).
The design is **two-pass** so token cost stays flat no matter how many projects,
suppliers, or contracts exist (those tables can hold thousands of rows).

### Pass 1 — Claude classification (one API call)

Claude receives:
- the document itself as a base64 `document` (PDF) or `image` block;
- the email subject + body as text;
- the **full category tree** — small and bounded, so it is safe to send whole, rendered
  as an indented list with each category's UUID;
- the list of valid `entity_type` values.

The call **forces** a tool invocation
(`tool_choice: { type: 'tool', name: 'classify_document' }`), which guarantees strict
JSON — no fragile free-text parsing. The tool returns:

| Field | Meaning |
|---|---|
| `category_id` | A category UUID, or `null` if none fits confidently. |
| `confidence` | `0–1` — how sure Claude is about the category. |
| `description` | Croatian summary + reasoning. **Always** filled. |
| `entity_hints` | `[{ entity_type, search_terms[] }]` — names/numbers read in the document, **not** database IDs. |

The system prompt and tool schema are static and marked
`cache_control: { type: 'ephemeral' }`, so repeated invocations hit the Anthropic
prompt cache.

### Pass 2 — entity resolution (in code)

`entity_hints` are free text. Resolving them to real IDs happens **in code**, against
the entity tables loaded up front:

- For each hint, its `search_terms` are normalised (lowercased, Croatian diacritics
  stripped) and fuzzy-matched (substring / containment) against the relevant table's
  searchable fields (`name`, `contract_number`, `oib`, unit `number`, …).
- **Exactly one match** → a `document_associations` row is emitted.
- **Several matches** → a *narrow* second Claude call (`pick_entity`, also a forced
  tool) is made with **only those ~3–10 candidate rows** for disambiguation.
- **No match** → the hint is dropped. The function never invents an association.

So Claude only ever sees the full (small) category list plus, at most, a handful of
candidate rows. The large tables are matched entirely in code.

### Confidence → Uncategorized fallback

`CONFIDENCE_THRESHOLD = 0.6` (a tunable constant in `classifier.ts`). The document is
filed with `category_id = null` if **any** of these hold:

- `confidence < CONFIDENCE_THRESHOLD`, or
- `category_id` is `null`, or
- `category_id` is not a real category id.

A null category leaves the document in the **All documents** view on the Documents page,
where it is tallied into the **Uncategorized** count shown in the sidebar
(`fetchCategoryCounts` already buckets null-category rows); there is no separate
Uncategorized node to filter on.
`description` is written with Claude's reasoning **regardless** of confidence, and
entity associations from Pass 2 are written **even when uncategorized** — a weak
category guess does not invalidate a strong project match.

---

## Duplicate Detection

Without idempotency, a Make.com retry — or the same file forwarded twice — would create
a duplicate `documents` row and burn a Claude call each time.

Each email-imported `documents` row stores `content_hash`: the **SHA-256 of the file
bytes**, as lowercase hex. Before classifying, the edge function:

1. hashes the decoded attachment bytes (`sha256Hex`);
2. queries `documents` for an existing row with that `content_hash`;
3. if one exists, returns `200 { document_id: <existing id>, duplicate: true }` and
   **stops** — no Claude call, no storage upload, no insert.

The check runs **before** classification, so a retry costs zero tokens. The
`content_hash` column has a partial index (`idx_documents_content_hash`,
`WHERE content_hash IS NOT NULL`) for fast lookups.

Documents created by other paths (in-app upload, legacy import) leave `content_hash`
null, so deduplication currently covers email imports only — see
[Known Limitations](#known-limitations).

---

## Data Model

No new tables — the feature reuses `documents`, `document_categories`,
`document_associations`, and the `documents` storage bucket. The relevant migrations:

| Migration | Change |
|---|---|
| [`20260521120000_documents_source_email_import.sql`](../supabase/migrations/20260521120000_documents_source_email_import.sql) | Extends the `documents_source_check` constraint with `'email_import'`. |
| [`20260521130000_documents_content_hash.sql`](../supabase/migrations/20260521130000_documents_content_hash.sql) | Adds the nullable `content_hash` column + its partial index. |
| [`20260525120000_documents_category_counts_filtered.sql`](../supabase/migrations/20260525120000_documents_category_counts_filtered.sql) | Replaces the parameter-less `get_document_category_counts()` RPC with a filter-aware version (project / entity / file-name / upload-date range) so the sidebar counts track the page's active filters. Email-imported rows are counted exactly like any other; NULL-`category_id` rows feed the **Uncategorized** total. |

Email-imported rows are written as:
- `source = 'email_import'`
- `uploaded_by = null` (no user)
- `category_id` = resolved category, or `null` for the Uncategorized fallback
- `description` = Claude's reasoning
- `content_hash` = SHA-256 of the file bytes
- `file_path` = `{uuid}/{sanitized filename}` in the `documents` bucket

The TypeScript `DocumentSource` union and `Document` interface in
[`src/components/Documents/types.ts`](../src/components/Documents/types.ts) were updated
to match (`'email_import'` and `content_hash`).

---

## Documents Module UI

The email pipeline adds **no** frontend code — emailed documents land in the same
[`src/components/Documents/`](../src/components/Documents/) module that staff use for
manual uploads and browsing. That module was since refactored from two monolithic files
into a composed set of components, a service, and tested utils; this section is the map
of where things now live, so the email feature's UI touchpoints (category counts, the
Uncategorized total, the classified document appearing in the list) stay traceable.

### Page composition

[`index.tsx`](../src/components/Documents/index.tsx) is now a thin orchestrator. It owns
the page state (selected category, filters, pagination, expanded tree nodes), runs the
fetch effects, and composes the pieces below. Two-column layout: a category sidebar on
the left and a filter bar + document list on the right.

| Piece | File | Role |
|---|---|---|
| `CategoryRow` | [`components/CategoryRow.tsx`](../src/components/Documents/components/CategoryRow.tsx) | One recursive row of the **sidebar** category tree. Renders the Croatian `name_hr` label, the rolled-up document count, and the expand/collapse chevron. `index.tsx` maps the root nodes to `CategoryRow`; clicking a row selects the category (and expands, never collapses), the chevron is the collapse control. |
| `DocumentListTable` | [`components/DocumentListTable.tsx`](../src/components/Documents/components/DocumentListTable.tsx) | The right-hand document list. Per-row category breadcrumb, project badges, open/delete actions, and an expandable detail row showing `description` (where email imports surface Claude's reasoning), other associations, and file size. Owns its own row-expansion state. |
| `EntityPicker` | [`components/EntityPicker.tsx`](../src/components/Documents/components/EntityPicker.tsx) | A `SearchableSelect` form field that lazily loads its options for a given `PickerEntity` (`project`, `subcontractor`, `contract`, `unit`, `customer`, `credit`), with optional subcontractor/project scoping. Used by the upload modal. |
| `FilePickerField` | [`components/FilePickerField.tsx`](../src/components/Documents/components/FilePickerField.tsx) | Drag-and-drop / click file input for the upload modal: multi-file, dedups on `(name, size)`, rejects files over the 50 MB bucket cap with a per-file toast. |
| `CategoryTree` | [`components/CategoryTree.tsx`](../src/components/Documents/components/CategoryTree.tsx) | A compact, scrollable category **picker** tree (distinct from the sidebar `CategoryRow` — no counts, bordered box). Used inside [`DocumentUploadModal`](../src/components/Documents/DocumentUploadModal.tsx) for choosing a category on upload. |

### Service & utils

| Piece | File | Role |
|---|---|---|
| `documentService` | [`services/documentService.ts`](../src/components/Documents/services/documentService.ts) | Unchanged in shape — the read/write/storage layer (`fetchCategories`, `fetchDocuments` via the `search_documents` RPC, `fetchCategoryCounts`, `uploadDocument`, `updateDocument`, `deleteDocument`, `getDocumentSignedUrl`). `fetchCategoryCounts` now takes the same `DocumentFilters` object as `fetchDocuments` (ignoring `categoryIds`) and calls the filter-aware RPC. `sanitizeFilename` was hardened to collapse `..` runs so Croatian `d.o.o.` filenames don't trip Storage's path-traversal check. |
| `documentOptionsService` | [`services/documentOptionsService.ts`](../src/components/Documents/services/documentOptionsService.ts) | New service holding the dropdown-option fetchers (`fetchProjectOptions`, `fetchSubcontractorOptions`, `fetchPhaseOptions`, `fetchContractOptions`, `fetchCreditOptions`) plus `fetchEntityOptions(type, scope)`, which `EntityPicker` uses to load scoped options (e.g. only contracts under the chosen subcontractor/project). Extracted out of `index.tsx`/the modal. |
| `treeHelpers` | [`utils/treeHelpers.ts`](../src/components/Documents/utils/treeHelpers.ts) | Pure tree functions: `buildIdMap` (id → category), `buildDescendantsMap` (a category click expands to its `[self + descendants]` uuid list for the search RPC), `rollupCounts` (sums own-counts up the tree so a parent shows its subtree total), and `flattenTree`. Unit-tested in [`treeHelpers.test.ts`](../src/components/Documents/utils/treeHelpers.test.ts). |
| `entityHelpers` | [`utils/entityHelpers.ts`](../src/components/Documents/utils/entityHelpers.ts) | `badgeVariantForType` (badge colour per entity type) and `resolveEntityLabel` (turns an association's `entity_id` into a human label via the loaded option lists, falling back to a short id). Used by `DocumentListTable`. |

### How an emailed document surfaces

When the `sort-document` function files a row, the next sidebar-count fetch picks it up
via `fetchCategoryCounts` → `get_document_category_counts` → `rollupCounts`, and the row
appears in `DocumentListTable` under its category breadcrumb. A low-confidence import
(`category_id = null`) is counted toward the **Uncategorized** total and shows Claude's
reasoning in the expandable detail row's `description`.

---

## Configuration & Secrets

**`supabase/config.toml`** — the function is registered with JWT verification disabled:

```toml
[functions.sort-document]
verify_jwt = false
```

**Secrets** (set with `supabase secrets set`):

| Secret | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key — **already exists**, reused from `ai-chat`. |
| `DOC_SORT_WEBHOOK_SECRET` | Shared secret; must match the `x-doc-sort-secret` header sent by Make.com. Use a long random string. |
| `DOC_SORT_MODEL` | *Optional.* Claude model id; code defaults to `claude-sonnet-4-6`. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Injected automatically by the Supabase runtime. |

---

## Error Handling

| Case | Handling |
|---|---|
| Missing/invalid `x-doc-sort-secret` | `401` |
| Non-POST method | `405` |
| Malformed JSON / missing attachment fields | `400` |
| Corrupt base64 | `400` |
| Unsupported file type | `415` (MIME whitelist re-checked server-side) |
| File > 50 MB | `413` |
| Function not configured (`DOC_SORT_WEBHOOK_SECRET` unset) | `500` |
| Duplicate file (same `content_hash`) | `200 { duplicate: true }`, no new row |
| Claude API failure | mapped like `ai-chat`'s `mapAnthropicError`; `5xx`; nothing written |
| Invalid `category_id` from Claude | treated as low-confidence → `category_id = null`, still stored |
| Storage upload OK but `documents` insert fails | storage object removed (rollback) |
| `document_associations` insert fails | `documents` row deleted + storage object removed |
| Partial batch | each attachment is an independent POST; Make.com "Resume" keeps the scenario alive |

---

## Deployment

1. **Apply the migrations** — `supabase db push` (or your usual migration step).
2. **Set secrets:**
   ```
   supabase secrets set DOC_SORT_WEBHOOK_SECRET=<long-random-string>
   # DOC_SORT_MODEL is optional; ANTHROPIC_API_KEY already exists
   ```
3. **Deploy the function:**
   ```
   supabase functions deploy sort-document
   ```
4. **Build the Make.com scenario** per [Make.com Scenario](#makecom-scenario), using the
   same `DOC_SORT_WEBHOOK_SECRET` value in the `x-doc-sort-secret` header.

---

## Verification

The classification logic (`normalize`, `matchesTerm`, `resolveHints` ambiguity /
hallucination guards, and the confidence/validity collapse in `classifyDocument`) is
covered by unit tests in
[`classifier.test.ts`](../supabase/functions/sort-document/classifier.test.ts) — no
network, no DB, no Claude tokens. Run `npm run test:functions` (or, from
`supabase/functions/`, `deno task test`).

1. **Happy path** — `supabase functions serve sort-document`, then:
   ```
   curl -X POST http://localhost:54321/functions/v1/sort-document \
     -H "Content-Type: application/json" -H "x-doc-sort-secret: <secret>" \
     -d '{"email_subject":"Ugovor","email_body":"...","attachment":{"file_name":"test.pdf","mime_type":"application/pdf","data_base64":"<base64>"}}'
   ```
   Expect `200 { document_id, duplicate: false, category_id, confidence, … }`.
2. **Auth / validation** — wrong or missing secret → `401`; unsupported MIME → `415`;
   file > 50 MB → `413`.
3. **Duplicate** — POST the **same** payload again → `200 { document_id: <same id>,
   duplicate: true }`, no new `documents` row, no Claude call (confirm via logs).
4. **DB** — confirm a `documents` row with `source = 'email_import'` and a non-null
   `content_hash`, the file in the `documents` bucket, and matching
   `document_associations` rows.
5. **UI** — open the Documents page: the document appears under its classified
   category; a deliberately ambiguous test file stays in **All documents** and is
   tallied into the **Uncategorized** count, with Claude's reasoning in the description.
6. **Low-confidence path** — feed a blank/irrelevant image → `category_id` null,
   `description` populated.
7. **End-to-end** — forward a real email with a PDF + an image + a `.docx` → two
   documents created, the `.docx` silently skipped, both classified.

---

## Known Limitations

- **No activity logging.** `activity_logs.user_id` and `user_role` are `NOT NULL`, and
  an email import has no user, so imports are **not** recorded in the activity log.
  A fast-follow would add a configured system-user UUID and log under it.
- **Deduplication covers email imports only.** In-app uploads and legacy imports leave
  `content_hash` null, so an emailed file is not detected as a duplicate of an
  identical file uploaded through the app. Populating `content_hash` in
  `documentService.uploadDocument` would close this gap.
- **PDF and image attachments only.** Word/Excel/other formats are filtered out by
  Make.com and rejected (`415`) by the function — Claude cannot read them natively.
- **No sender allow-list.** Any email reaching the mailbox is processed. Restrict at
  the mailbox / Make.com level if untrusted senders are a concern.
- **Confidence threshold is a fixed constant** (`0.6`) — tune it in `classifier.ts` if
  too many documents land in (or skip) the Uncategorized bucket.
