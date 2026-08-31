# ERP integration — rewrite of the financial section

Tracking folder for replacing in-app invoice and payment authorship with imports
from **4D Wand**, the ERP the company adopted.

| Document | What it is |
|---|---|
| [SPEC.md](./SPEC.md) | The design. Data model, feed formats, classification rules, cutover plan. The thing to read first. |
| [PROGRESS.md](./PROGRESS.md) | Phase-by-phase status. What is done, what is next. |
| [DECISIONS.md](./DECISIONS.md) | Decision log — what was chosen, and why, so choices are not silently relitigated. |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | Questions blocking work, with owner and status. |
| [AGENT.md](./AGENT.md) | Contract for the on-prem push agent — not yet written. |
| [LEDGER_NOTES.md](./LEDGER_NOTES.md) | What the raw GL export looks like. Reference only. |

## The shape of it in one paragraph

4D Wand becomes the source of truth for invoices, payments and bank balances.
Cognilion stops creating and editing them and becomes a consumer that imports,
classifies and links. Everything downstream — dashboards, debt status, contract
realization, milestone progress, Sales buyer tracking, Funding credit
utilization — keeps reading `accounting_invoices` / `accounting_payments`
unchanged, and the existing database triggers keep those derivations
consistent. We are changing *who writes* those two tables, not what hangs off
them.

## Current status

Phases 0–2 are done and applied to LandmarkDev; the `import-erp` function is
deployed there. Phase 3 — classification and promotion — is next. See
[PROGRESS.md](./PROGRESS.md).

Both earlier blockers are gone: accounting confirmed cost centres will be
booked and OIBs populated, and confirmed we define the export format. That last
point removed the riskiest piece of the design — the importer consumes
invoice-shaped feeds instead of rebuilding invoices out of ledger postings.

Nothing reaches `accounting_invoices` yet. Files import, validate and stage;
promotion is phase 3.

## Sample data

Real exports live in `docs/erp-samples/`, which is **gitignored** — they contain
supplier names and amounts and do not belong in the repository. Ask a
colleague for a copy rather than committing one.
