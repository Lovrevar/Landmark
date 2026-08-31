# ERP integration — rewrite of the financial section

Tracking folder for replacing in-app invoice and payment authorship with imports
from **4D Wand**, the ERP the company adopted.

| Document | What it is |
|---|---|
| [SPEC.md](./SPEC.md) | The design. Data model, feed formats, classification rules, cutover plan. The thing to read first. |
| [PROGRESS.md](./PROGRESS.md) | Phase-by-phase status. What is done, what is next. |
| [DECISIONS.md](./DECISIONS.md) | Decision log — what was chosen, and why, so choices are not silently relitigated. |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | Questions blocking work, with owner and status. |

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

Phase 0 is done and applied to LandmarkDev. Phase 1 (reference data and code
mappings) is in progress. See [PROGRESS.md](./PROGRESS.md).

**Two things block real progress**, both in
[OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) and needing accounting, not code:

1. **Cost centres are not booked.** `MjTr` is empty in every posting we have
   seen, and it was to be the basis of automatic project assignment. Without it
   manual classification is permanent rather than exceptional, which caps the
   value of the whole integration.
2. **The export carries no OIB.** Partners appear only as an internal numeric
   id, so a separate *komitenti* export is required before any invoice can be
   attributed to a supplier.

## Sample data

Real exports live in `docs/erp-samples/`, which is **gitignored** — they contain
supplier names and amounts and do not belong in the repository. Ask a
colleague for a copy rather than committing one.
