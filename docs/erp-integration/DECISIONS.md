# Decision log

Decisions taken, with the reasoning, so they are not silently relitigated.
Newest last.

---

### D1 — 4D Wand is the source of truth; Cognilion stops authoring invoices
**2026-08-31 · settled**

Invoice and payment creation and editing leave the app entirely. Bank balances
come from the ERP rather than being derived client-side.

**Why:** the company's accounting moved to 4D Wand, and two systems authoring
the same financial documents would drift immediately with no way to say which
is right.

### D2 — CSV/file export, not an API
**2026-08-31 · settled, forced**

4D Wand offers no usable API. Integration is by scheduled file export.

**Consequence:** no `updated_since` cursors, no tombstones, no ability to
re-query a document. This is what forces D3 and the reconciliation work.

### D3 — Full snapshots of a rolling window, not deltas
**2026-08-31 · settled**

Every export is all documents in the current and previous fiscal year.

**Why:** the load-bearing decision. CSV cannot express "this record was
deleted", and Croatian accounting corrects by storno and reissue. With a delta
feed, a storno that retracts a document is simply absent from every later file
and we would never learn it vanished — the invoice would sit in Cognilion
forever inflating debt and contract realization. A full snapshot lets us diff
for disappearance. The cost is file size, which at this volume is nothing.

### D4 — Full historical re-import, with link carry-forward
**2026-08-31 · settled (user decision)**

Existing invoices are replaced by imported ones rather than reconciled in
place. But the manual links (contract, milestone, apartment, credit line) are
snapshotted first and re-applied by natural key afterwards.

**Why:** the user chose full re-import for the clean end state. Carry-forward
was added because the ERP knows nothing about those links, and a naive wipe
would zero every one — the triggers would then recalculate every contract
realization and milestone status to zero. The count of unmatched carry-forward
rows is the cutover acceptance gate.

### D5 — Enforce read-only in RLS, not just by deleting UI
**2026-08-31 · settled**

Writes to `accounting_invoices` / `accounting_payments` are restricted to the
service role.

**Why:** removing a modal removes a button, not a capability — anyone can still
call `supabase.from(...)` from the browser console. Same reasoning that makes
`VITE_CASHFLOW_PASSWORD` a speedbump rather than a security boundary. E2E
factories use the service-role client, so they are unaffected.

### D6 — `erp_document_key` is text, not an id column
**2026-08-31 · settled**

Document identity is `{year}/{Nal.}/{Dok.}/{Lok. dok.}`, e.g. `2026/5/UFA/4`.

**Why:** the export is a general ledger. Its per-row `ID` identifies a
*posting*, and one invoice is several postings, so no single row id can key an
invoice. Only the composite does.

### D7 — Integration objects live in an `erp` schema, not `public`
**2026-08-31 · settled**

**Why:** roughly 15 new tables would otherwise clutter a `public` schema that
already has 200+. It also makes the whole thing resettable during development
with `DROP SCHEMA erp CASCADE`, and gives a natural security boundary — the
schema is not exposed through PostgREST, so staging data is unreachable from
the browser by default. Phase 1 adds `public` views for the few tables the UI
genuinely needs.

### D8 — Store the posted base/VAT split; never recompute it
**2026-08-31 · settled**

**Why:** in the sample the split frequently does not match the nominal rate —
6.77 base against 0.81 VAT on the 13% account (≈12.0%), 4024.47 against 438.53
(≈10.9%), most likely partial input-VAT deductibility. A recomputed figure
would silently disagree with the ledger. See [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) Q13.

### D9 — Balance checks are per journal (`Nal.`), not per document
**2026-08-31 · settled**

**Why:** a batch payment books the bank line under one `Lok. dok.` and its
allocations under another — in the sample, 228.04 and 7.50 under different
document numbers summing to one 235.54 transfer. A per-document balance check
reports false imbalances on every batch payment.

### D10 — The importer never guesses
**2026-08-31 · settled**

An unresolvable invoice type, partner, or payment allocation goes to the review
queue rather than being assigned by precedence or best guess.

**Why:** a wrong automatic link is worse than an absent one. An absent link is
visible in a queue someone works through; a wrong one is invisible and
propagates through contract realization and debt reporting silently.
