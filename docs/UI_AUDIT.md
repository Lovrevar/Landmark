# UI Audit — September 2026

**Date:** 2026-09-15
**Method:** five parallel read-only reviews of `src/components/` (~52k lines of TSX), each covering one area and checking every finding against the code. The ~15 highest-severity claims were then re-checked independently; all held.
**Status:** `[ ]` open · `[~]` in progress · `[x]` fixed in code (see the note on each for anything still to verify)

Paths are relative to the repository root. Line numbers are as of the audit date and drift as code changes.

---

## Summary

### 1. Actually broken

These are bugs rather than design issues: buttons that do nothing, data silently dropped, double submits.

- [x] **Task comments post twice on Ctrl+Enter.** The drawer's own key handler caught the keypress after the comment box had already sent it. — [TaskDetail.tsx](../src/components/Tasks/TaskDetail.tsx)
- [x] **Escape on a confirm dialog also closed the window behind it** (task drawer, event details, AI panel with its draft). Every layer had its own document listener, so the parent heard Escape first. Fixed with the shared `useEscapeKey` stack. — [useEscapeKey.ts](../src/hooks/useEscapeKey.ts)
- [x] **`Modal.Header` dropped its children,** so Subcontractor details never showed its payment-status badge, "no contract" badge or contact line. — [Modal.tsx](../src/components/ui/Modal.tsx)
- [x] **Edit subcontractor: cost classification changes were never saved.** — [useSubcontractorManagement.ts](../src/components/Supervision/SiteManagement/hooks/useSubcontractorManagement.ts)
- [x] **Edit subcontractor: "Mark as completed" had no click handler.** Removed. — [EditSubcontractorModal.tsx](../src/components/Supervision/SiteManagement/modals/EditSubcontractorModal.tsx)
- [x] **Project milestones.** Edit did nothing (no handler passed), and Delete did nothing (its confirm dialog was never rendered). Both buttons were hover-only, so phones never saw them. — [ProjectDetailsEnhanced.tsx](../src/components/General/Projects/ProjectDetailsEnhanced.tsx)
- [x] **Sales payment history: Edit and Delete called services that always throw,** and failed silently. — [PaymentHistoryModal.tsx](../src/components/Sales/Apartments/modals/PaymentHistoryModal.tsx)
- [x] **Sales "Select all" selected every unit,** including Sold units and units hidden by the filter, and the selection survived a tab switch. A bulk price change then hit units the user couldn't see. — [SalesProjects/index.tsx](../src/components/Sales/SalesProjects/index.tsx)
- [x] **Duplicate records on double-click.** "Complete sale" and 5 creation/bulk modals had no loading state; neither did Supervision work logs.
- [x] **Retail "Add new supplier" selected the alphabetically last supplier,** not the one just created. — [ContractFormModal.tsx](../src/components/Retail/Projects/modals/ContractFormModal.tsx)
- [x] **Director dashboard "View details" went to `/funding-overview`,** which doesn't exist, so it bounced home. — [DirectorDashboard.tsx](../src/components/dashboards/DirectorDashboard.tsx)
- [~] **Cashflow invoices.** Sorting only reordered the 100 rows on the current page, and every filter or search change swapped the page for a spinner, so the search box lost focus while typing. The server-side sort needs migration `20260915120000_invoice_list_server_sort.sql` applied. — [Invoices/index.tsx](../src/components/Cashflow/Invoices/index.tsx)
- [x] **Funding: a credit with no maturity date showed "Jan 01, 1970",** and editing it failed. — [Investments/index.tsx](../src/components/Funding/Investments/index.tsx)
- [x] **Calendar task checkboxes.** They did nothing in the day list and "Next up", and ignored the read-only and checklist rules in the month view.

Found alongside section 1 (not a UI issue):

- [~] **`get_filtered_invoices` bypassed invoice RLS.** It is SECURITY DEFINER with no role check, so any authenticated user could list every invoice. It now requires Director/Accounting, and EXECUTE is revoked on five unused SECURITY DEFINER finance functions. Waits on migration `20260916100000_lock_down_finance_definer_functions.sql` being applied. — see [SECURITY_BACKLOG.md](./SECURITY_BACKLOG.md)
- [~] **Editing a payment left the old bank account and credit allocation stale.** The triggers handled INSERT and DELETE only. Waits on migration `20260917100000_payment_update_balance_triggers.sql` being applied.
- [x] **The shared Excel number parser corrupted decimals.** `parseNumber` stripped every dot, so a numeric cell of 12.5 imported as 125 (apartments, garages and the TIC import). Numeric cells now pass through unchanged. — [excelParsers.ts](../src/utils/excelParsers.ts)

### 2. Same kind of bug as the dark-mode stripe (a stronger rule silently overrides a colour)

- [x] **Mobile table CSS** (`.responsive-table tbody tr { background }`) beats row-tint classes, so on phones the overdue invoice tint, the Cashflow calendar status tint and the Approvals selection highlight disappear. Card colours now sit in `:where()` at zero specificity, and sticky cells go transparent in the card view. — [index.css](../src/index.css)
- [x] **`Table.Td`** has a built-in `dark:text-gray-100`, so callers' `text-green-600` is lost in dark mode (Sales payments, Retail sales). The default colour moved to `Table.Body` and is inherited; 20 coloured cells gained a dark pair.
- [x] **Ghost `Button`** has `dark:text-gray-200`, so ~10 red delete icons turn grey in dark mode. New `ghost-primary/-success/-warning/-danger` and soft `warning` variants; all 13 recoloured ghost buttons migrated. — [Button.tsx](../src/components/ui/Button.tsx)
- [x] **Supervision `InvoicesModal`:** `bg-white` beats `bg-red-50` in the built CSS, so overdue invoices aren't red even in light mode. Same bug fixed in Retail's `RetailInvoicesModal`.

The app-wide sweep found no remaining side-border + `dark:border` conflicts, no `confirm()` or `alert()`, and no Tailwind classes built at runtime.

### 3. Information shown in a misleading way (the "Yellow" chip class)

- [ ] **Work log stripe colour** is user-picked (red/green/yellow) and sits next to a status badge that uses the same colours to mean blocker or finished. The dashboard week view shows only the stripe and hides the status.
- [ ] **Calendar:** a task's colour doesn't appear at all in the month view (the default), and elsewhere it's a 2px dot, which no longer matches the tinted task list. A red stripe means both "deadline event" and "overdue task" side by side.
- [ ] **Approvals:** every row carries the same green "Odobreno" badge, next to a raw `UNPAID` value.
- [ ] **Funding payments:** every row shows the same "BANKA" badge. Disbursements, repayments and expenses are all green and summed into one total.
- [ ] **"Gain/Loss" shows the unpaid remainder as green profit** in Supervision contract cards and Retail phase cards.
- [ ] **"Očekivani ROI"** is really the average interest rate, shown green as if it were a return.
- [ ] **Cashflow dashboard:** monthly bars are scaled per month, so the larger bar is always full width. Net cash flow uses `Math.abs`, so a negative value is shown only by colour.
- [ ] **Office suppliers:** "Ukupno (bez PDV)" is net while Plaćeno and Preostalo are gross, so the three never add up.
- [ ] **Sales reports show `$` on EUR amounts.**
- [ ] **Retail phase card** shows "Predviđeni budžet" twice, for two different numbers.
- [ ] **Unread indicators:** the three red header badges mean three different things, and opening Tasks marks everything read, so the blue unread dot is never seen.

### 4. App-wide systemic problems

1. [~] **Money formatting.** *(Fixed: the shared helpers now cover exact cents, aggregates and compact tiles and are null-safe; every `en-US`, browser-locale, `$`, `€0.0M` and `€`-suffix render is gone. Left: ~255 hand-rolled `toLocaleString('hr-HR')` money renders that show ragged decimals, and 76 DollarSign icons outside Reports/dashboards.)* `formatEuro` / `formatEuroRounded` exist in `utils/formatters.ts` but are barely used (0 uses in Cashflow, Sales or Retail). Instead there are hundreds of hand-rolled formats:
   - `en-US` ("€1,234,567", which reads wrong to Croatians)
   - browser locale
   - `€X.XM`, so €45.000 shows as "€0.0M"
   - € sometimes before the number, sometimes after
2. [ ] **Dates.** ~50 `'MMM dd, yyyy'` with no locale, so month names are English in the Croatian UI. 5+ formats overall, and 60 native date inputs vs 11 uses of `DateInput`.
3. [ ] **Status colours and labels.** The same status is coloured differently per screen: UNPAID is red, grey or yellow; On Hold is red, orange, grey or yellow; "Paid" is teal, orange, green, blue or red. Raw English DB enums show in 20+ places. Needs one shared status → {label, variant} map per domain.
4. [~] **Silent failures.** *(Fixed: ~60 hook-shaped loaders now expose `error` + `refetch` and render `ErrorState` with a retry instead of an empty state, with figures withheld rather than shown as 0; the services that hid failures behind `return []` or a dropped `error` now throw; all 25 silent mutations report, and no dialog closes in a `finally` any more; success feedback added where the only signal was a spinner flash. Two e2e tests pin the behaviour by aborting the API. Left: the ~23 fetches written inline inside components, and the full-page spinner on refetch.)*
5. [ ] **Hardcoded strings (~300).**
   - Sales has ~150, the most of any module.
   - The Director alerts panel is entirely English.
   - PDF exports ignore the UI language.
   - English placeholders such as "John Smith" and "+1 (555)".
6. [~] **The shared library itself.** *(dialog semantics + focus management, FormField label linking and the dark error text are fixed; toast contrast fixed; Alert `onClose` / StatCard `trend` and the stale docs remain)*
   - Modal and ConfirmDialog have no `role="dialog"` or focus management.
   - `FormField` labels aren't linked to their inputs (419 usages).
   - The warning toast is white on yellow (~2:1 contrast).
   - `Alert` ignores `onClose`, and `StatCard` ignores `trend`.
   - `docs/UI.md` is stale in 4 places.
7. [ ] **Hand-rolled primitives.**
   - ~60 KPI tiles instead of `StatCard`.
   - ~12 raw tables with no mobile view.
   - 6 dashboards each hand-roll their header and grid.
   - 4 modal-footer styles.
   - "Export PDF" styled as a red danger button in 3 places.
8. [ ] **Mobile.**
   - Hover-only actions (AI chat edit/regenerate, and others).
   - Non-wrapping header rows in Supervision, which is used on phones on site.
   - 1400px invoice table.
   - Calendar defaults to the month view on phones.
9. [ ] **Dark-mode contrast.** ~380 `text-*-600` accents with no `dark:` variant.

### Suggested order

1. Section 1 — small, isolated fixes.
2. The three shared-component overrides (Table/Td, ghost Button, responsive-table CSS), plus Modal focus management — one fix each, app-wide effect.
3. Formatters, status maps and date locale — mechanical sweeps once shared helpers exist.
4. Section 3 — each needs a product decision on what the screen should say.

---

## Cashflow

### Top findings

1. **[Invoices/index.tsx:169](../src/components/Cashflow/Invoices/index.tsx#L169) + `hooks/useInvoices.ts:75`** — States/UX · high · `[~]`
   - **Problem:** every filter change and every search (after 500 ms) replaces the whole page, filter bar included, with a spinner. The search box unmounts mid-typing, losing focus and later keystrokes, and the page jumps to the top.
   - **Fix:** keep the filter bar mounted and show loading inside the table.
2. **`useInvoices.ts:105`, `DebtStatus/hooks/useDebtStatus.ts:34`, `Approvals/hooks/useApprovals.ts:56`, `Loans/hooks/useLoans.ts:42`** — States · high
   - **Problem:** load errors only go to the console, so a failure shows the normal empty state. Debt Status reads "no debt" and Approvals reads "Svi odobreni računi su obrađeni i skriveni", which is false financial information.
   - **Fix:** an error state with a Retry button, separate from the empty state.
3. **[InvoiceFilters.tsx:57-62](../src/components/Cashflow/Invoices/InvoiceFilters.tsx#L57) + `useInvoices.ts:42-44`** — Terminology/UX · high · `[x]` (categories now follow the direction toggle)
   - **Problem:** the type dropdown always offers "ULAZNI (DOB/URED/INV/BANKA)" and "IZLAZNI (PROD)", whatever the Ulazni/Izlazni toggle says. With Izlazni selected, "ULAZNI (DOB)" actually filters OUTGOING_SUPPLIER, and impossible combinations return an empty table. The company filter says "Svi dobavljači" but lists your own companies.
   - **Fix:** derive the options from the selected direction and rename the company filter to "Sve firme".
4. **[Invoices/index.tsx:129](../src/components/Cashflow/Invoices/index.tsx#L129)** — UX · high · `[~]` (needs the migration applied)
   - **Problem:** sorting by Dospijeće or Broj reorders only the 100 rows on the current page.
   - **Fix:** sort on the server.
5. **[index.css:124-134](../src/index.css#L124) vs `InvoiceTable.tsx:110`, `Calendar/index.tsx:278-284`, `Approvals/index.tsx:233`** — Dark mode/specificity · high
   - **Problem:** below 768px, `.responsive-table tbody tr { background }` outranks `bg-red-50` / `dark:bg-red-900/20`, so the overdue tint, the Calendar status tint and the Approvals selection highlight are silently removed. Separately, the sticky actions cell is `bg-white`, which cuts the overdue tint short on desktop.
   - **Fix:** use `:where()` for the card backgrounds, or a data attribute the mobile CSS respects.
6. **[OfficeSuppliers/index.tsx:156-165](../src/components/Cashflow/OfficeSuppliers/index.tsx#L156) + `services/officeSupplierService.ts:39-41`** — Information · high · `[x]` (gross basis reconciles; net kept as a labelled line)
   - **Problem:** "Ukupno (bez PDV)" is net, while Plaćeno and Preostalo include VAT. Paid can exceed the total, and the figures never add up.
   - **Fix:** show gross totals next to paid and remaining, or label each figure's basis.
7. **[Approvals/index.tsx:275-278](../src/components/Cashflow/Approvals/index.tsx#L275)** — Information · high
   - **Problem:** every row has the same green "Odobreno" badge, next to the raw `UNPAID` / `PARTIALLY_PAID` enum, coloured differently from everywhere else.
   - **Fix:** drop the constant badge and reuse the shared translated status label and colours.
8. **[AccountingPaymentFormModal.tsx:88-108](../src/components/Cashflow/Payments/forms/AccountingPaymentFormModal.tsx#L88), `components/InvoiceEntityFields.tsx:78,160,175`, `Suppliers/forms/LinkSupplierToProjectModal.tsx:154`** — Library/UX · high
   - **Problem:** the invoice picker is a native select listing every open invoice as one long string, with no search. The supplier and customer pickers are the same. `SearchableSelect` is used nowhere in Cashflow.
   - **Fix:** use `SearchableSelect` with a sublabel.
9. **`Payments/forms/PaymentFormModal.tsx` vs `AccountingPaymentFormModal.tsx`** — Consistency · med-high · `[x]` (aligned: shared validator/payload, CurrencyInput, summary + partial alert)
   - **Problem:** two different "record payment" dialogs:

     | | From the invoice row | From the Payments page |
     |---|---|---|
     | Size | `sm` | `md` |
     | Amount field | `CurrencyInput` | `type="number"` (rejects "1.234,56") |
     | Submit button | green "Potvrdi plaćanje" | blue "Kreiraj" |
     | Paid/remaining summary | yes | no |

   - **Fix:** merge them into one form.
10. **[PaymentTable.tsx:95](../src/components/Cashflow/Payments/PaymentTable.tsx#L95) vs `:75-80`; `Payments/index.tsx:103`** — Colour/Info · med
    - **Problem:** amounts are always green, even on red "RASHOD" rows. The 7 stat cards cover all payments while the table and its total follow the filters. The VAT cards format in the browser's locale.
    - **Fix:** colour amounts by direction, compute stats from the filtered set, and use `StatGrid`.
11. **`AccountingPaymentFormModal.tsx:115-128` + `:294-302` (same in `PaymentFormModal.tsx`)** — UX · med · `[x]` (method limited by source; Kompenzacija shows "—")
    - **Problem:** users pick both "Izvor plaćanja" and "Način plaćanja", and contradictory pairs such as Gotovina + Virman are accepted.
    - **Fix:** derive one from the other, or constrain the options.
12. **[Banks/index.tsx:312,318,325](../src/components/Cashflow/Banks/index.tsx#L312)** — Formatting/Colour · med
    - **Problem:**
      - Dates are English ("Sep 15, 2026") and money is "€1.234,5".
      - The "Dug" tile's colour follows `netUsed` but the tile shows `outstanding_balance`.
      - "Nealocirano" can never turn red.
      - Raw status, English "EQUITY" / "Unnamed Credit", and the credit amount shown twice.
    - **Fix:** `dd.MM.yyyy` + `formatEuro`, colour driven by the displayed value, translated status.
13. **[InvoiceActionButtons.tsx:24-62](../src/components/Cashflow/Invoices/InvoiceActionButtons.tsx#L24); `Suppliers/index.tsx:137-142`** — UX/Library · med
    - **Problem:** five create buttons in five colours with no clear primary action. Suppliers has two "primary" buttons.
    - **Fix:** one primary "Novi račun" with a type menu.
14. **`Approvals/index.tsx:193-199` + `:306-314`** — States · med
    - **Problem:** a search with no results shows two stacked empty states.
    - **Fix:** render only the search one when a search term is active.
15. **[Cashflow/Calendar/index.tsx:55-63](../src/components/Cashflow/Calendar/index.tsx#L55)** — UX (data loss) · med
    - **Problem:** switching the year in the budget modal silently discards unsaved monthly edits.
    - **Fix:** warn first, or keep edits per year.
16. **`Cashflow/Calendar/index.tsx:276-309`, `:72-82`** — Colour/Info · med
    - **Problem:** status is shown four ways, so a paid incoming invoice shows a red amount on a green row. BANK types show a raw `INCOMING_BANK`, and the same gap exists in `PaymentDetailView.tsx` and `AccountingPaymentFormModal.tsx`.
    - **Fix:** one status carrier and a shared type-label map.
17. **[Customers/index.tsx:152-178](../src/components/Cashflow/Customers/index.tsx#L152)** — Information/Colour · med
    - **Problem:** income/expense is shown three times per card. "Preostalo" is red on a green card, and UNPAID is grey here but red elsewhere.
    - **Fix:** one indicator and a standard status colour.
18. **[BankInvoiceFormModal.tsx:348-363](../src/components/Cashflow/Banks/forms/BankInvoiceFormModal.tsx#L348)** — Library/Mobile · med
    - **Problem:** the buttons sit inside the scrolling body, so you scroll past ~17 fields to submit. Ghost Cancel with a green submit, and a bright `border-t` in dark mode.
    - **Fix:** use `<Modal.Footer>` with secondary/primary buttons.
19. **Invoice-type vocabulary** — Terminology · med
    - **Problem:** the same concept has five names: "ULAZNI (DOB)" / "Ulazni (Dobavljač)" / "Ulazni dobavljač" / "RASHOD" / "Ulazni". "INV" is "Investicije" in one place and "investitor" in another.
    - **Fix:** one translated label source.
20. **[LandPurchaseFormModal.tsx](../src/components/Cashflow/Invoices/forms/LandPurchaseFormModal.tsx)** — Library/Dark/Mobile · med-low
    - **Problem:**
      - Hand-rolled segmented toggle with hardcoded "Retail".
      - 5 raw selects in slate, with labels not linked to their inputs.
      - Section panels vanish against the dark modal.
      - `col-span-2` in a 1-column phone grid.
      - "1.234,56 €" suffix format.
      - Submit disabled with no explanation.
    - **Fix:** `SegmentedControl`, `FormField` / `Select`, `sm:col-span-2`, `formatEuro`.
21. **`Invoices/InvoiceDetailView.tsx:104,131,158,183,241,261,267`; `Payments/PaymentDetailView.tsx:163,179,194,200`** — Dark mode · low-med
    - **Problem:** bare `border-t` draws bright dividers in the dark modal.
    - **Fix:** `border-gray-200 dark:border-gray-700`.
22. **`Suppliers/forms/LinkSupplierToProjectModal.tsx:137-209`; `Suppliers/modals/SupplierDetailsModal.tsx:24-45,179-185`** — Library · low-med
    - **Problem:** no header close button, a `text-2xl` title and a non-sticky footer. The details header is hand-rolled with hardcoded "Retail" / "Site" / "Close".
    - **Fix:** `Modal.Header` / `Modal.Footer`.
23. **[CompanyFormModal.tsx:58-103](../src/components/Cashflow/Companies/forms/CompanyFormModal.tsx#L58)** — UX friction · low-med
    - **Problem:** bank accounts are added via a "number of accounts" select (1–10), and you can't add one while editing. The balance is `type="number"` and the date input is native.
    - **Fix:** add/remove rows, `CurrencyInput` and `DateInput`.
24. **[DebtStatus/index.tsx:68](../src/components/Cashflow/DebtStatus/index.tsx#L68), `:30-36`** — Colour/i18n · low
    - **Problem:** "Export PDF" uses the red danger style. Supplier types show "Office/Mixed/Site" in English, and "(Retail)" / "(Site)" is hardcoded.
    - **Fix:** secondary buttons for exports; translate.
25. **`Loans/index.tsx:131`, `Calendar/index.tsx:158-159`, `Banks/index.tsx:173`** — A11y · low
    - **Problem:** icon-only buttons have no `title` / `aria-label`. `InvoiceTable.tsx` and `PaymentTable.tsx` have hardcoded Croatian titles. `Suppliers/index.tsx:264` has a decorative Eye icon that looks like a button.
    - **Fix:** translated `aria-label`s; remove the decorative icon.

### Systemic patterns

- **Full-page spinner on every refetch (9 pages).** Saves and filter changes unmount the page, open modals included: `Invoices/index.tsx:169`, `Payments/index.tsx:63`, `Suppliers/index.tsx:123`, `Companies/index.tsx:40`, `DebtStatus/index.tsx:54`. There are no success toasts in Cashflow, so this flash is the only save feedback.
- **Load errors swallowed in ~12 hooks:** `useAccountingCustomers.ts:29`, `useBankeCredits.ts:28`, `useSuppliers.ts:39`, `useCompanies.ts:41`, plus #2 above.
- **Currency drift.**
  - 78× `toLocaleString('hr-HR')` without fraction digits.
  - 6× `toLocaleString(undefined, …)`.
  - 6× "€" after the number vs 133× before.
  - 4× a literal "€0.00" with a dot.
  - `formatEuro` used 0 times.
  - Three copies of the VAT summary component, one of which multiplies directly.
- **Date drift.** 12× `dd.MM.yyyy`, 4× `MMM dd, yyyy`, 2× `toLocaleDateString('hr-HR')`, plus one native date input.
- **Status and amount colour drift.** UNPAID is red, grey or yellow. "Partial" is worded two ways. "Preostalo" is red, orange or yellow.
- **Red and green overloaded.** Red means incoming type, overdue, unpaid, not-approved X, remaining, expense, destructive and PDF export. Green means outgoing, paid, cash payment method, every payment amount, "unallocated" and "success" submit.
- **5 hand-rolled tables** instead of `<Table>`: `Loans`, `Approvals`, `Calendar`, `DebtStatus`, `Customers`.
- **Other hand-rolled primitives:**
  - 2 segmented toggles
  - 6 raw `<select>`
  - a duplicated column menu
  - status pills built from spans instead of `Badge`
  - info boxes instead of `Alert`
- **Money typed into `type="number"` in 4 forms:** `AccountingPaymentFormModal.tsx:283`, `Loans/index.tsx:227`, `Calendar/forms/BudgetModal.tsx:61`, `CompanyFormModal.tsx:87`.
- **Modal footer drift.** Cancel is secondary vs ghost; submit is primary vs green; Close is secondary vs ghost vs recoloured ghost. Sibling invoice forms use sizes md, lg, xl and md.
- **Card actions differ across sibling list pages** (Suppliers, Office suppliers, Companies).
- **Hardcoded strings.**
  - 24 literal toasts, 8 literal `title=` and 8× `'N/A'`.
  - Hardcoded label maps in `invoiceHelpers.ts` / `paymentHelpers.ts`.
  - 5 validation messages in `useLoans.ts`.
  - English values inside the hr locale (`debt_status.supplier_types`, `invoices.form.subtotal`).
- **Bare checkboxes for booleans:** Cesija in `PaymentFormModal.tsx:194` and `AccountingPaymentFormModal.tsx:237`.
- **Dead UI:** `Banks/forms/BankCreditFormModal.tsx` (310 lines) is unreachable.
- **ERP / Šifrarnici (hidden):** nothing glaring; they are the most consistent screens in the module.

### Good patterns worth copying

- `Suppliers/index.tsx:154-270`: `FilterBar` + `FilterChip` + `SortDropdown` + `ListViewToggle` with `useListPreferences`, and a dense `Table` with `Td label`. This is the template for Office suppliers, Companies and Loans.
- All four invoice forms show duplicate invoice numbers as an inline field error, and `PaymentFormModal.tsx:273-286` previews full vs partial payment before saving.
- `ErpImport/index.tsx` and `Sifrarnici/index.tsx` use the shared library throughout.

---

## Supervision + General

### Top findings

1. **[General/Projects/MilestoneTimeline.tsx:99](../src/components/General/Projects/MilestoneTimeline.tsx#L99) + `ProjectDetailsEnhanced.tsx:440-448`** — UX/Mobile/States · high · `[x]`
   - **Problem:** milestone actions are hover-only, so phones never see them. Edit does nothing because `onEdit` is never passed. Delete sets pending state, but no ConfirmDialog is rendered.
   - **Fix:** wire the handlers, render the ConfirmDialog, make actions visible below `md`.
2. **[SubcontractorDetailsModal.tsx:104-118](../src/components/Supervision/SiteManagement/modals/SubcontractorDetailsModal.tsx#L104)** — States · high · `[x]`
   - **Problem:** the status badges and contact line are passed as children of `Modal.Header`, which ignores children.
   - **Fix:** `Modal.Header` now renders children.
3. **[useSubcontractorManagement.ts:151-168](../src/components/Supervision/SiteManagement/hooks/useSubcontractorManagement.ts#L151)** — UX · high · `[x]`
   - **Problem:** Edit Subcontractor lets you change the cost classification, but the hook never forwards `classification_id`, so the change is silently lost.
   - **Fix:** forward it.
4. **[EditSubcontractorModal.tsx:400-404](../src/components/Supervision/SiteManagement/modals/EditSubcontractorModal.tsx#L400)** — UX · high · `[x]`
   - **Problem:** the green "Mark as completed" button has no `onClick`.
   - **Fix:** removed.
5. **[ContractCard.tsx:43,101-116](../src/components/Supervision/SiteManagement/ContractCard.tsx#L43)** — Info/Colour · high
   - **Problem:** for an unpaid contract, "Gain/Loss" shows the unpaid amount as green "+€50.000", under an orange "Remaining €50.000". `SubcontractorDetailsModal` computes it against net (`base_amount`) instead of gross (`cost`), so the two disagree.
   - **Fix:** show a variance only once settled or overpaid, from one consistent base.
6. **[ProjectDetail.tsx:132-206](../src/components/Supervision/SiteManagement/ProjectDetail.tsx#L132), `PhaseCard.tsx:74-110`** — Mobile · high
   - **Problem:** non-wrapping header rows full of badges, toggles and buttons overflow off-screen on phones.
   - **Fix:** `flex-wrap` / stacking or `PageHeader`; secondary actions in a menu.
7. **[TreeGroup.tsx:138-185](../src/components/Supervision/SiteManagement/TreeGroup.tsx#L138)** — Mobile · high
   - **Problem:** fixed Cost and Paid columns plus the action slot take ~344px, which leaves the group label about 0px on a phone.
   - **Fix:** stack the figures under the label below `sm`.
8. **[Supervision/Invoices/index.tsx:104,135,157](../src/components/Supervision/Invoices/index.tsx#L104)** — Mobile/Library/Info · high
   - **Problem:** a hand-rolled `min-w-[1400px]` table with no mobile view. Status and category badges show raw enums ("PARTIALLY_PAID", "SUPERVISION"), while `InvoicesModal` translates the same statuses.
   - **Fix:** `Table` with `Td label`, plus a shared status map.
9. **[WorkLogs/index.tsx:231-243,279,286](../src/components/Supervision/WorkLogs/index.tsx#L231)** — Info/Colour · high
   - **Problem:** a user-picked stripe colour (red/green/yellow/orange) sits next to a status badge that uses the same colours for blocker/finished/waiting, so a "red" log can be "work finished". Swatch tooltips are raw English, and the stripes are CSS named colours (#0000ff) rather than Tailwind's palette.
   - **Fix:** drop the free colour, or derive the stripe from status.
10. **Project status shown four ways** (`ProjectsGrid.tsx:57-63`, `ProjectDetail.tsx:153-158`, `ProjectDetailsEnhanced.tsx:131-136`, `ProjectCard.tsx:171-177` via `utils.ts:153-161`) — Formatting/Colour/i18n · med-high
    - **Problem:** raw English enums or hardcoded English labels. "On Hold" is yellow in General and grey in Supervision.
    - **Fix:** one `projectStatus` helper returning a translated label and variant.
11. **[General/Projects/utils.ts:163-168](../src/components/General/Projects/utils.ts#L163), `ProjectCard.tsx:186-195`, `ProjectDetailsEnhanced.tsx:164`** — Colour/Info · high
    - **Problem:** once the end date passes, the General card shows green "Completed" even while the status is In Progress. Supervision shows red "N days overdue" for the same project, and the detail tile shows "-45 days" in blue. The budget "Remaining" is green even when negative, and the pages disagree on whether a budget is set.
    - **Fix:** reuse the TIC gate and the overdue wording.
12. **[InvoicesModal.tsx:124-126,166-168](../src/components/Supervision/SiteManagement/modals/InvoicesModal.tsx#L124)** — Dark mode/specificity · med
    - **Problem:** `.bg-white` is emitted after `.bg-red-50`, so overdue invoice cards have no red background, and `font-medium` beats `font-bold`.
    - **Fix:** move `bg-white` / `font-medium` into the else branch.
13. **[ProjectsGrid.tsx:100-144](../src/components/Supervision/SiteManagement/ProjectsGrid.tsx#L100)** — Colour/Formatting · med
    - **Problem:** paid is orange in the grid's progress bar, but in `PhaseCard` paid is teal and orange means unpaid. `€{(x/1e6).toFixed(1)}M` renders €45.000 as "€0.0M".
    - **Fix:** teal for paid; `formatEuroRounded`.
14. **Overdue flagged on the due date itself** — `ContractCard.tsx:41`, `Subcontractors/SubcontractorContractsList.tsx:20-24,116` ("Kasni za 0 dana"), `General/Projects/utils.ts:149,197`, `MilestoneTimeline.tsx:147,153,170` — Formatting/Colour · med
    - **Problem:** the same bug commit 89c985a fixed for invoices.
    - **Fix:** `daysFromToday()` from `utils/dateOnly`.
15. **[BudgetControl/index.tsx:314-326,356-360,469,507](../src/components/General/BudgetControl/index.tsx#L314)** — i18n/Formatting/Colour · med
    - **Problem:** hardcoded English CPI/SPI sublabels; two currency formats on one screen; "Committed" has a green ring while the chart draws committed in amber; the EAC bar is always red.
    - **Fix:** translate, use one formatter, align colours with the chart.
16. **[ContractCard.tsx:48-79,132-190](../src/components/Supervision/SiteManagement/ContractCard.tsx#L48)** — Info/UX · med
    - **Problem:** six buttons per card (three solid blue primaries, an unlabelled amber icon, a solid red Delete), and payment status shown twice.
    - **Fix:** one primary action, the rest in an overflow menu; show the badge or the tint, not both.
17. **[SubcontractorBasicFormModal.tsx:212-217](../src/components/Supervision/Subcontractors/forms/SubcontractorBasicFormModal.tsx#L212) + `Subcontractors/index.tsx:280`** — UX · med · `[x]` (reset keyed on visible/editingId)
    - **Problem:** `initialData` is a new object on every render, so a failed-save error toast re-renders the parent and wipes the user's input.
    - **Fix:** memoize `initialData`, or reset only when `visible` flips.
18. **[PhaseSetupModal.tsx:88-100](../src/components/Supervision/SiteManagement/modals/PhaseSetupModal.tsx#L88) + `services/phaseService.ts:103-127`** — i18n/UX · med · `[x]` (confirms removals; translated dependant error)
    - **Problem:** lowering the phase count silently deletes trailing phases on save. The detailed service error is replaced by a generic English toast. The subtitle mentions a budget that now comes from TIC.
    - **Fix:** per-row remove with ConfirmDialog; surface the service message.
19. **[ManageCostClassificationsModal.tsx:106-121](../src/components/Supervision/SiteManagement/modals/ManageCostClassificationsModal.tsx#L106)** — i18n/A11y/States · med · `[x]` (ConfirmDialog, labelled sort input, real error handling)
    - **Problem:** delete fires with no confirmation from an untitled icon. The sort-order input is unlabelled and saves on blur with no feedback.
    - **Fix:** ConfirmDialog, a label, save feedback.
20. **[PaymentHistoryModal.tsx:84-86,159-161,208-211](../src/components/Supervision/SiteManagement/modals/PaymentHistoryModal.tsx#L84)** — Colour/States · med
    - **Problem:** it checks `'paid'` while the data holds `'PAID'`, so every badge is yellow with raw text. The "managed in accounting" note repeats on every row.
    - **Fix:** shared status map; say it once in the header.
21. **[SiteManagement/index.tsx:501-510](../src/components/Supervision/SiteManagement/index.tsx#L501) + `MilestoneList.tsx:145`** — UX/Formatting · med
    - **Problem:** MilestoneList sits in `Modal size="full"` without `Modal.Body`, so nothing scrolls. The page mixes browser-locale and `hr-HR` amounts. "Ugovor (osnova)" shows the gross amount.
    - **Fix:** wrap in `Modal.Body`, use `formatEuro`, show `base_amount`.
22. **[SubcontractorFormModal.tsx:153,184-199,250-259,364](../src/components/Supervision/SiteManagement/forms/SubcontractorFormModal.tsx#L153)** — States/i18n/Library · med
    - **Problem:** Add is silently disabled when the total exceeds a budget derived from the stale `budget_used`. The has-contract flag is a bare checkbox inside a permanent yellow Alert, and new/existing is a pair of raw radios.
    - **Fix:** show the reason inline; `ToggleSwitch` + `SegmentedControl`.
23. **[EditSubcontractorModal.tsx:52-86,349-359](../src/components/Supervision/SiteManagement/modals/EditSubcontractorModal.tsx#L52)** — States/UX · med · `[x]` (full reset, stale-response guard, files upload on save)
    - **Problem:** the modal doesn't reset between opens, so the previous contract's values show until the fetch returns, and Save is enabled during loading. Picked files are discarded on Save unless Upload was clicked.
    - **Fix:** reset on open, disable Save while loading, upload on save.
24. **[ProjectSummaryBanner.tsx:57](../src/components/Supervision/SiteManagement/ProjectSummaryBanner.tsx#L57) vs `PhaseCard.tsx:120-125`, `TreeGroup.tsx:156-162`, `ContractCard.tsx:97-100`** — Colour/permissions · med
    - **Problem:** paid figures are hidden in the banner for users without payment rights, but shown in the tiles, tree and cards below.
    - **Fix:** pass `canManagePayments` consistently.
25. **[WorkLogs/index.tsx:86-97](../src/components/Supervision/WorkLogs/index.tsx#L86) + `hooks/useWorkLogs.ts:46`** — States · med · `[x]` for the double submit
    - **Problem:** the submit handler doesn't return its promise, so a double tap creates duplicate logs. A load failure shows the "no logs yet" state.
    - **Fix:** return the promise; add an error state.

### Systemic patterns

- **Hardcoded strings (~45, mixed English/Croatian).**
  - English toasts: `useProjectPhases.ts`, `useSubcontractorManagement.ts`, `useMilestoneManagement.ts`, `useWorkLogs.ts`, `useSupervisionInvoices.ts`.
  - Croatian literals: `useSubcontractorManagement.ts:58-146`.
  - English label maps: `General/Projects/utils.ts:153-216`, `BudgetControl/index.tsx:357-359`.
- **Raw DB enums shown to users (~11):** `ProjectDetailsEnhanced.tsx`, `MilestoneList.tsx:285`, `Invoices/index.tsx`, `PaymentHistoryModal.tsx:160`, `ActivityLogTable.tsx:258,269`.
- **Dates — 5 formats, none locale-aware.** English `'MMM dd, yyyy'` in 13 places, `'dd.MM.yyyy'` in 3, plus `'MMMM dd, yyyy'`, `'d. MMM yyyy.'` and `toLocaleString`.
- **Currency — ~40 call sites bypass `utils/formatters`:** `ContractCard`, `ProjectCard`, `Payments/index.tsx`, `ProjectDetailsEnhanced`, `MilestoneList`, `MilestoneFormModal`, `ProjectsGrid`, `BudgetControl`.
- **The same money figure has different names and colours.** `budget_realized` is labelled Paid / Paid out / Realized / Spent / Total expenses, in teal, orange, green, blue or red. "Remaining" is orange, yellow or green even when negative.
- **~10 hand-rolled stat-tile blocks** instead of `StatCard`.
- **Other hand-rolled primitives:**
  - tables (2)
  - segmented controls (2)
  - tabs (1)
  - bare boolean checkboxes (2)
  - native selects and inputs
  - 4 page headers not using `PageHeader`
  - extra `p-6` page padding on some pages
  - 4 duplicate body-scroll-lock effects
- **Icon-only buttons with no title or aria-label (11),** built three different ways; tap targets are ~24-28px.
- **Load errors swallowed into misleading empty states (~10).** 0 `toast.success` calls in scope.
- **Non-wrapping flex rows that break on phones (~9).**
- **Dark mode.**
  - ~62 `-600` accents with no `dark:` variant.
  - Milestone status circles have no dark counterparts.
  - Recharts grid and ticks are hardcoded for light mode (`BudgetControl`).
- **Three different definitions of "overdue":** paid < cost, progress < 100, status ≠ Completed.

### Good patterns worth copying

- `Supervision/SiteManagement/ContractDocumentViewer.tsx`: loading, error and empty states; titled icon buttons with per-item spinners; a ConfirmDialog that names the file.
- `Supervision/Subcontractors/index.tsx`: `PageHeader`, `StatGrid`, FilterChip / SortDropdown / ListViewToggle with persisted preferences, a responsive `Table`, and distinct "none yet" vs "no match" empty states.
- `Supervision/SiteManagement/TreeGroup.tsx`: disabled rows keep the chevron's space, `aria-expanded` is set, and `tabular-nums` columns align. It just needs a mobile layout.

---

## Sales + Retail

Clean checks: no `window.confirm` / `alert`, no Tailwind classes built at runtime, and no `opacity-0 group-hover` in either module.

### Top findings

1. **[Sales/Apartments/modals/PaymentHistoryModal.tsx:183-196](../src/components/Sales/Apartments/modals/PaymentHistoryModal.tsx#L183), `Apartments/index.tsx:121-154`, `services/apartmentService.ts:142-150`** — States/UX · high · `[x]`
   - **Problem:** every payment row shows Edit and Delete, but both services always throw. The user confirms and nothing happens.
   - **Fix:** remove them; show the "managed in accounting" note.
2. **[Retail/Projects/PhaseCard.tsx:206,322-330](../src/components/Retail/Projects/PhaseCard.tsx#L206)** — Info/Colour · high
   - **Problem:** a partly paid contract shows the unpaid remainder as a green "+€X" gain under an orange "Preostalo" of the same amount.
   - **Fix:** show gain/loss only once fully paid.
3. **[Retail/Projects/modals/ContractFormModal.tsx:102-110](../src/components/Retail/Projects/modals/ContractFormModal.tsx#L102), `forms/DevelopmentFormModal.tsx:100-108`** — UX · high · `[x]`
   - **Problem:** after "Add new" supplier, the form silently picks the last supplier in a name-sorted list.
   - **Fix:** select the created supplier's id.
4. **[Sales/SalesProjects/index.tsx:259-268,432](../src/components/Sales/SalesProjects/index.tsx#L259), `UnitsGrid.tsx:88,169`** — UX · high · `[x]`
   - **Problem:** Select all ignores the status filter and includes Sold units. Selection survives tab switches, so bulk price changes hit invisible units.
   - **Fix:** select the filtered unsold units, clear on tab/filter change, add a server guard.
5. **[Sales/SalesProjects/forms/SaleFormModal.tsx:72-84,272](../src/components/Sales/SalesProjects/forms/SaleFormModal.tsx#L72), `SalesProjects/index.tsx:456-525`** — States · high · `[x]`
   - **Problem:** "Complete sale" has no loading or disabled state, so a double-click creates two sales and two customers. The same is true for the Building quantity / Single unit / Bulk units / Bulk price modals.
   - **Fix:** return the promise so `Button` shows loading.
6. **[Sales/Customers/CustomerCard.tsx:35,80,166](../src/components/Sales/Customers/CustomerCard.tsx#L35)** — Info/UX · high · `[x]` (card opens details; checkbox selects)
   - **Problem:** clicking anywhere on a card silently toggles selection with no checkbox. The default view shows no lead/buyer status, and purchases only appear once a category tab is active.
   - **Fix:** a visible checkbox, a status badge, always show purchases.
7. **Raw English DB values in the Croatian UI** — `UnitsGrid.tsx:345`, `ApartmentDetailsModal.tsx:65,151`, `Sales/SalesProjects/ProjectsGrid.tsx:31`, `Retail/Projects/ProjectsGrid.tsx:33`, `Retail/Projects/ProjectDetail.tsx:207`, `Sales/Payments/index.tsx:107`, `Retail/Sales/index.tsx:118`, `PaymentHistoryModal.tsx:177` — i18n/Formatting · med-high
   - **Problem:** "Available", "In Progress", `payment_method` codes and "Type: Down payment" appear untranslated.
   - **Fix:** map them through `t()`.
8. **[Sales/Apartments/index.tsx:57-154,518-531](../src/components/Sales/Apartments/index.tsx#L57)** — States/i18n · med
   - **Problem:** create/update/delete failures are console-only. The delete dialog is half Croatian, half English.
   - **Fix:** error toasts and the `confirm.*` keys.
9. **[Sales/Apartments/index.tsx:219-228,285-296,378-427](../src/components/Sales/Apartments/index.tsx#L219)** — Info/Colour/UX · med
   - **Problem:** unit status shows only as a background tint, with no marker for Available. The "all" chip reads "Status", the title says "Unit" in English, and each card has 5 full-width buttons.
   - **Fix:** a status Badge, "Svi", and collapsed secondary actions.
10. **Money formatting** — `SingleUnitModal.tsx:105,108`, `BulkPriceUpdateModal.tsx:102,166`, `CustomerCard.tsx:110,119`, `Retail/utils.ts:1-8`, `Retail/Projects/forms/ProjectFormModal.tsx:185` — Formatting · med
    - **Problem:** "€12,345.00" (en-US), "€450K" next to "€450.000", "€45.50"; Sales writes "€12.345" while Retail writes "12.345 €".
    - **Fix:** `formatEuro` / `formatEuroRounded` everywhere.
11. **Dates** — `Sales/Payments/index.tsx:91,95`, `CustomerCard.tsx:75`, `PhaseCard.tsx:268 vs 302`, `ContractFormModal.tsx:202` vs `SalesFormModal.tsx:184` — Formatting · med
    - **Problem:** English months in Sales vs `dd.MM.yyyy` in Retail, both formats in one card, and a mix of date input types.
    - **Fix:** one date formatter and one date input.
12. **[Retail/Projects/PhaseCard.tsx:106,149](../src/components/Retail/Projects/PhaseCard.tsx#L106)** — Info · med · `[x]` (second tile is Preostali budžet; rollup shared with Supervision)
    - **Problem:** "Predviđeni budžet" appears twice, for allocated and for remaining budget.
    - **Fix:** rename the second to "Preostali budžet".
13. **[Sales/Payments/index.tsx:104](../src/components/Sales/Payments/index.tsx#L104), `Retail/Sales/index.tsx:112,115,119`** — Dark mode/specificity · med
    - **Problem:** `Table.Td`'s built-in `dark:text-gray-100` overrides `text-green-600` / `text-gray-500`.
    - **Fix:** add `dark:` pairs or a `Td` tone prop.
14. **[Retail/Projects/PhaseCard.tsx:109-120,347-389](../src/components/Retail/Projects/PhaseCard.tsx#L109)** — A11y/UX · med
    - **Problem:** untitled phase icon buttons; an emoji-only "📊" milestones button next to three identical primaries.
    - **Fix:** titles, a proper label, and demote the secondary actions.
15. **Status colours per screen** — `PhaseCard.tsx:214,221`, `Retail/Projects/MilestoneList.tsx:269`, `Retail/Invoices/index.tsx:165-168`, `Retail/Sales/RetailSales.tsx:199-203`, `Sales/SalesProjects/ProjectsGrid.tsx:12`, `Retail/utils.ts:10-22`, `CustomerCard.tsx:154` vs `PaymentHistoryModal.tsx:94` — Colour · med
    - **Problem:** Partial is yellow in one place and blue ("U čekanju") in another; Unpaid is grey or red; Planning is grey or yellow.
    - **Fix:** one shared status → Badge variant map.
16. **Failed loads read as "no data"** — `Retail/Projects/MilestoneList.tsx:55-58`, `RetailPaymentHistoryModal.tsx:60`, `RetailInvoicesModal.tsx:52`, `ContractFormModal.tsx:47-49`, `Sales/SalesProjects/hooks/useSalesData.ts:173` — States · med
    - **Problem:** load failures show "no milestones" / "no payments" / an empty dropdown. Sales ProjectsGrid and BuildingsGrid have no empty state.
    - **Fix:** an error state plus `EmptyState`.
17. **[Retail/Projects/ProjectDetail.tsx:349-365](../src/components/Retail/Projects/ProjectDetail.tsx#L349), `MilestoneList.tsx:148-153`** — Library/A11y · med
    - **Problem:** the milestones panel is a hand-rolled overlay with no portal, backdrop close or scroll lock, and an unlabelled SVG close button.
    - **Fix:** `<Modal size="full">`.
18. **[Retail/LandPlots/index.tsx:191-199](../src/components/Retail/LandPlots/index.tsx#L191), `Retail/Invoices/index.tsx:128-141`, `Retail/Projects/ProjectsGrid.tsx:36`** — Colour/Dark/i18n/UX · med
    - **Problem:** a green "Plaćeno" next to a green "U projektu". Approval is a one-click toggle with no confirmation or feedback. A hand-rolled `bg-emerald-100` pill has no dark variant.
    - **Fix:** a blue/grey link badge; `Badge` plus a confirmed approve control.
19. **[Sales/SalesProjects/modals/LinkingModal.tsx:44-47,74](../src/components/Sales/SalesProjects/modals/LinkingModal.tsx#L44) vs `Sales/Apartments/modals/LinkUnitsModal.tsx`, `UnitsGrid.tsx:310,328`** — UX/A11y · med
    - **Problem:** two different linking flows (one-click-and-close vs multi-select + Save). Unlinking is instant from an unlabelled 12px icon.
    - **Fix:** use `LinkUnitsModal` in both places.
20. **[Sales/Customers/CategoryTabs.tsx:22-23](../src/components/Sales/Customers/CategoryTabs.tsx#L22)** — Library/UX · med
    - **Problem:** there is no "Svi" tab; clicking the active tab silently shows everyone.
    - **Fix:** `Tabs` with an explicit "all" tab.
21. **[Sales/SalesProjects/modals/ExcelImportApartmentsModal.tsx:180,235-250,346](../src/components/Sales/SalesProjects/modals/ExcelImportApartmentsModal.tsx#L180)** — i18n/States · med · `[x]` (honest result screen, row errors, no closing mid-import)
    - **Problem:** English instructions; "Please check the console." A green tick appears even when 0 rows were imported, and the modal can be closed mid-import.
    - **Fix:** translate, a failure state, block closing during import.
22. **[BulkPriceUpdateModal.tsx:166-207](../src/components/Sales/SalesProjects/modals/BulkPriceUpdateModal.tsx#L166)** — i18n/Dark · low-med
    - **Problem:** hardcoded English preview and warnings; the "cannot be undone" warning shows before any input; preview colours have no dark variant.
    - **Fix:** translate; warn only once a value is entered.
23. **[SaleFormModal.tsx:147,163,171,223](../src/components/Sales/SalesProjects/forms/SaleFormModal.tsx#L147), `ContractFormModal.tsx:165`, `DevelopmentFormModal.tsx:169`** — i18n/Formatting · low-med
    - **Problem:** US placeholders ("John Smith", "+1 (555) 123-4567"); 3 bare boolean checkboxes.
    - **Fix:** `ToggleSwitch` and Croatian placeholders.
24. **[Retail/Projects/ProjectDetail.tsx:187,200](../src/components/Retail/Projects/ProjectDetail.tsx#L187), `Retail/Invoices/index.tsx:42,109`** — Library/Mobile · low
    - **Problem:** double page padding, a hand-rolled h1, a hand-rolled table.
    - **Fix:** `PageHeader` and `Table`.
25. **Icons** — `SalesProjects/index.tsx:350-382`, `UnitsGrid.tsx:109-115`, `Retail/Customers/index.tsx:51-54` — Library/Info · low
    - **Problem:** Plus vs Building2 icons swap between views; a DollarSign icon in an EUR app; four identical Users icons.
    - **Fix:** fixed icons per action; Euro/Banknote.

### Systemic patterns

- **Hardcoded strings (~150 in Sales, ~25 in Retail).**
  - Sales, English: `ExcelImportApartmentsModal` ~35, `ExcelImportGaragesModal` ~25, `SalesProjects/index.tsx` 13 toasts, `ApartmentDetailsModal`, `CustomerCard`, `EditPaymentModal`.
  - Retail, mostly Croatian: `'Faza: '` ×3, `'N/A'` ×6, 11 toasts, English status options in `EditPhaseModal`.
- **No success feedback:** 0 `toast.success` across 49 files, and 76 `console.error`, many with no toast.
- **Hand-rolled primitives:**
  - tabs / chips ×4
  - stat tiles ×5
  - error boxes instead of `Alert` ×5
  - tables ×3
  - 1 overlay
  - 1 pill
  - raw buttons
- **Destructive-action styling drift (3 styles):** solid `danger`, `outline-danger`, and a bare grey trash icon. Confirm labels use 4 variants.
- **Icon-only buttons without title/aria-label (~11).**
- **Dark-mode gaps.**
  - ~140 `text-*-600/700` with no `dark:` pair.
  - 11 `border-green/yellow-200` with no dark border.
  - The 4 `Td` overrides (finding 13).
- **Duplicate currency formatters:** six local `Intl` formatters in Retail, 31 bare `toLocaleString()`, and `formatEuro` unused.
- **Drill-down navigation held in component state** (`Sales/SalesProjects/index.tsx:42-47`, `Retail/Projects/index.tsx:14`): Back leaves the module, and a reload loses your place.
- **Where Retail diverges from Sales on sibling screens:**
  - **Payments pages:** near-clones that drift apart.
  - **Customers:** different selection, filters and stats.
  - **Payment history:** Sales showed dead buttons; Retail shows the accounting note.
  - **Sale creation:** Sales can create a customer inline; Retail can't.
  - **Page chrome:** `PageHeader` in Sales, a hand-rolled header in Retail.

### Good patterns worth copying

- **Retail list pages** (`Retail/LandPlots/index.tsx:155-213`, `Retail/Sales/RetailSales.tsx`): a responsive `Table` with a `label` on every `Td`, an `EmptyState` distinguishing no-data from no-results, titled `outline-danger` icon actions, and translated `ConfirmDialog`s.
- **`Sales/Apartments/modals/LinkUnitsModal.tsx`:** multi-select with an explicit Save, unavailable units disabled with the reason shown, and a loading state.
- **Deletes:** every delete in both modules goes through `ConfirmDialog` with a `loading` prop.

---

## Funding + dashboards + Reports

### Top findings

1. **[Reports/SalesReports.tsx:169,177,178,188,293,294,349](../src/components/Reports/SalesReports.tsx#L169) (also `pdf/salesReportPdf.ts:95`)** — Formatting · high · `[x]` (formatEuro / formatEuroCompact, Euro icons)
   - **Problem:** budget, revenue, average price and average purchase show a `$` sign in an EUR app.
   - **Fix:** `formatEuro`.
2. **[Funding/Projects/index.tsx:122-126](../src/components/Funding/Projects/index.tsx#L122), `Projects/modals/InvestmentProjectModal.tsx:106-109,198-199`** — Info · high · `[x]` (renamed to average interest rate; now weighted over debt only)
   - **Problem:** `expected_roi` is a plain average of loan interest rates (`investmentService.ts:44-46`), shown green as "Očekivani ROI" and described as a "weighted average".
   - **Fix:** rename it to average interest rate; drop "weighted" and the green.
3. **[dashboards/DirectorDashboard.tsx:145](../src/components/dashboards/DirectorDashboard.tsx#L145)** — UX · high · `[x]`
   - **Problem:** "View details" navigates to the non-existent `/funding-overview`.
   - **Fix:** `/funding-credits`.
4. **[dashboards/sections/AccountingMonthlyTrendsSection.tsx:27,36,46](../src/components/dashboards/sections/AccountingMonthlyTrendsSection.tsx#L27)** — Misleading chart · high
   - **Problem:** each month's bars are scaled to that month's max, so they aren't comparable. The white € label is clipped inside short bars.
   - **Fix:** scale across all months and put labels outside the bars.
5. **[Funding/Payments/index.tsx:140-151,68,172](../src/components/Funding/Payments/index.tsx#L140)** — Info/Colour · high
   - **Problem:** the same "BANKA" badge on every row. Disbursements, repayments and expenses are all green and summed into one total.
   - **Fix:** show the direction as the type, colour by direction, total each separately.
6. **[dashboards/services/directorService.ts:445-485](../src/components/dashboards/services/directorService.ts#L445) → `sections/DirectorAlertsSection.tsx:45,51`** — i18n · high
   - **Problem:** the General dashboard's alert panel is entirely English and formats with no locale.
   - **Fix:** return keys and params, translate in the section.
7. **Cashflow dashboard money in `en-US`** — `AccountingVATSection.tsx:26-47`, `AccountingCashFlowSection.tsx:38-106`, `AccountingBudgetSection.tsx:34-48`, `AccountingMonthlyTrendsSection.tsx:39-55` — Formatting · high · `[x]` (all 18 sites on the shared helpers)
   - **Problem:** "€1,234,567" (en-US), while the same dashboard uses `hr-HR` elsewhere, and decimals vary.
   - **Fix:** `formatEuroRounded` / `formatEuro` only.
8. **[AccountingCashFlowSection.tsx:98,106](../src/components/dashboards/sections/AccountingCashFlowSection.tsx#L98), `AccountingCompaniesSection.tsx:53`** — Colour-only · high · `[x]` (sign shown, not colour alone)
   - **Problem:** `Math.abs` removes the sign, so a negative balance reads as positive with only colour showing it.
   - **Fix:** show the sign or a "deficit" label as text.
9. **[Funding/Investors/services/creditService.ts:66](../src/components/Funding/Investors/services/creditService.ts#L66) + `Funding/Investments/index.tsx:239`** — UX · high · `[x]`
   - **Problem:** a null maturity renders "Jan 01, 1970", and editing sends `''` to a date column, which fails with an English toast.
   - **Fix:** `|| null` on update; render "—".
10. **[dashboards/SalesDashboard.tsx:90-108](../src/components/dashboards/SalesDashboard.tsx#L90) (`services/salesDashboardService.ts:98`)** — Info · med-high
    - **Problem:** "Monthly target" is a hardcoded €5M, and the white % label is unreadable on the grey track.
    - **Fix:** a real target or remove the section; put the label beside the bar.
11. **[InvestorCard.tsx:2,28-45](../src/components/Funding/Investors/components/InvestorCard.tsx#L2), `CreditFacilityCard.tsx:2,117-118`, `Investments/AllocationRow.tsx:134`** — A11y · med
    - **Problem:** `CreditCard as Edit2` puts a credit-card icon on every Edit button. The icon-only buttons have no labels.
    - **Fix:** import the real pencil icon and add labels.
12. **Utilisation colour scales** — `InvestorCard.tsx:67-71` vs `InvestmentCreditsTable.tsx:131-133` vs `InvestmentProjectModal.tsx:329-331` vs `:347-350` — Colour · med
    - **Problem:** three different thresholds and palettes for utilisation; text and bar disagree for the same value.
    - **Fix:** one `utilizationTone()` helper.
13. **[dashboards/sections/SupervisionWeekView.tsx:36,48](../src/components/dashboards/sections/SupervisionWeekView.tsx#L36)** — Colour · med
    - **Problem:** the user-picked stripe uses raw CSS keywords (pure #FFFF00). The real status (blocker, quality issue…) is never shown, and every date pill is green.
    - **Fix:** a status badge, a neutral date pill, and the Tailwind palette.
14. **[CreditFacilityCard.tsx:21,32-47,62](../src/components/Funding/Investors/components/CreditFacilityCard.tsx#L21)** — Info/Colour/i18n · med
    - **Problem:** 4–5 badges of raw uppercase enums ("LINE OF_CREDIT" — only the first `_` is replaced), with orange meaning three things. "Maturing soon" also fires on credits that have already matured.
    - **Fix:** translate, merge the badges, fix the day range.
15. **[InvestmentProjectModal.tsx:56-58,285-286,300,237-245](../src/components/Funding/Projects/modals/InvestmentProjectModal.tsx#L56)** — States · med
    - **Problem:** the Funding tab refetches with no loading state, so "no funding sources" flashes. Every source has an identical green badge. "Days remaining" goes negative.
    - **Fix:** a loading state; drop the badge; render "N days overdue".
16. **[Funding/Investments/index.tsx:121+134,141-156,72-74](../src/components/Funding/Investments/index.tsx#L121)** — Info/Colour · med
    - **Problem:** the credit amount appears twice. The "Debt" tile's colour follows a different value from the one shown. "Unallocated" can't turn red. "Paid out" is orange here and green below.
    - **Fix:** drop the duplicate, colour from the displayed value, red for over-allocation.
17. **[dashboards/RetailDashboard.tsx:51,59,64-71,116](../src/components/dashboards/RetailDashboard.tsx#L51)** — Info · med
    - **Problem:** "Aktivnih" subtitles count every row. Invested and Costs are the same number in two colours. Query errors are ignored, so failures read as 0.
    - **Fix:** fix the subtitles, show the figure once, check errors.
18. **[Funding/Investors/index.tsx:41](../src/components/Funding/Investors/index.tsx#L41) + `hooks/useBankData.ts:24`** — States · med
    - **Problem:** every save or delete swaps the page for a spinner, so an open detail modal disappears and returns. Same in `Funding/Projects/index.tsx:45`.
    - **Fix:** show the spinner on first load only.
19. **Risk labels** — `Funding/Projects/index.tsx:79`, `Reports/GeneralReports.tsx:395`, `Investors/utils/creditCalculations.ts:103-105` — i18n · med
    - **Problem:** "High Rizik" / "Rizik Medium".
    - **Fix:** translate the enum.
20. **Project status** — `DirectorProjectsTable.tsx:66-71`, `Reports/ProjectPerformanceTable.tsx:66-71`, `Funding/Projects/index.tsx:67-73`, `Reports/SalesReports.tsx:154-160` — Colour/i18n · med
    - **Problem:** raw English status; "On Hold" is red, orange or grey.
    - **Fix:** one status → variant + label map.
21. **[Funding/Payments/index.tsx:37-56](../src/components/Funding/Payments/index.tsx#L37)** — UX · med
    - **Problem:** the CSV export has English headers, no quoting, no BOM (so diacritics break) and no toast.
    - **Fix:** XLSX via the shared exporter.
22. **Silent failures** — `Funding/Investments/hooks/useLazySection.ts:14`, `Reports/GeneralReports.tsx:48-50`, `Funding/TIC/index.tsx:84-86` — States · med
    - **Problem:** a failed fetch is cached as "no invoices"; a failed report has no retry; a failed TIC export does nothing visible.
    - **Fix:** error with retry; toast on export failure.
23. **[Reports/SalesAnalysis.tsx:157-160](../src/components/Reports/SalesAnalysis.tsx#L157), `Reports/CostAnalysis.tsx:118,191-192,174 vs 197`** — Colour/Info · low-med
    - **Problem:** an unlabelled dot legend; a "Status" column that shows the supplier type; two different greens for "paid".
    - **Fix:** label the legend, rename the column, one "paid" colour.
24. **[dashboards/SupervisionDashboard.tsx:89](../src/components/dashboards/SupervisionDashboard.tsx#L89)** — Mobile · low-med
    - **Problem:** `grid-cols-1 md:grid-cols-6` gives six tall cards on phones and ~110px cards at 768px; two KPIs share the same teal.
    - **Fix:** `<StatGrid columns={6}>` and distinct colours.
25. **"Export PDF" as a danger button** — `dashboards/InvestmentDashboard.tsx:70`, `Funding/TIC/index.tsx:149` — Colour/Library · low
    - **Problem:** `variant="danger"`; the TIC PDF export isn't awaited and has no error handling.
    - **Fix:** `secondary`, via `useAsyncExport`.

### Systemic patterns

- **Money formatting drift (~140 sites).**
  - 51 abbreviated `€${(x/1e6).toFixed(2)}M` / `K`.
  - 18 `en-US`, 25 with no locale, 71 `hr-HR`.
  - Only 6 uses of `formatEuro`.
  - TIC puts € after the number; `PaymentSchedulePreview` shows no currency.
- **Dates (33 sites).** 29 date-fns `'MMM dd[, yyyy]'` with no locale (English month names), 4 `'dd.MM.yyyy'`.
- **Hardcoded strings (~60).** The `GeneralReports` exec summary, `SalesReports`, `directorService`, `SupervisionStatusView` ("d over" / "d left"), and 12 English toasts in the Funding hooks.
- **PDF exports ignore the UI language** (4 generators; `salesReportPdf` also uses `$`).
- **Same metric, different colour (≥8 pairs):** "Used", "Repaid", "Sales rate", "Outstanding debt".
- **Hand-rolled KPI tiles instead of `StatCard` (~40 tiles in 10 files),** plus local `StatCard` / `KpiCard` clones.
- **Dashboards don't share a skeleton (6/6).**
  - Each has its own `h1 text-3xl` header and a different KPI grid.
  - StatCard size is `lg` on 4 dashboards and `md` on 1.
  - Every "chart" is a hand-built div bar (no Recharts in scope).
- **Hand-rolled tabs, tables and empty states.** Raw tables without `responsive-table`; `ProjectPerformanceTable` has unlabelled mobile cells and an unstyled mobile `tfoot`; ~7 hand-rolled empty states.
- **Missing empty states:** Investors, Funding Projects, SalesDashboard sections, SalesReports.
- **Dark mode.** ~179 `text-*-600` accents with no `dark:` variant, and the modal's active tab has no dark variant.
- **False hover affordance (4):** `hover:shadow-md` on cards that aren't clickable.
- **Header touches content** on 3 Funding pages (no spacing).
- **Inconsistent save feedback.** Equity shows a toast; credit, bank and allocation don't. A bank update with an empty name returns silently. TIC uses an inline Alert. There is one bare checkbox.

### Good patterns worth copying

- **TIC module:**
  - The unsaved-changes guard also covers switching project.
  - The ConfirmDialog states how many rows are affected.
  - Every icon button is labelled.
  - A split mismatch is flagged rather than silently fixed.
- **`dashboards/DashboardError.tsx` + `loading && !data`:** a failed load shows an explicit error with retry instead of zeros.
- **Investor and credit deletes** look up linked invoices and warn before confirming.

---

## Tasks, Calendar, Chat, AI Chat, Documents, app shell, `ui/` library

### Top findings

1. **[Tasks/TaskDetail.tsx:227-233,259](../src/components/Tasks/TaskDetail.tsx) + `components/MentionPicker.tsx:117-119`** — States/bug · high · `[x]`
   - **Problem:** Ctrl+Enter in the comment box posts twice. The drawer-level handler also posts the draft from other fields.
   - **Fix:** delete the drawer-level handler.
2. **[Tasks/TaskDetail.tsx:106](../src/components/Tasks/TaskDetail.tsx), `ui/Modal.tsx:40`, `AiChat/AiChatPanel.tsx:19`** — UX/A11y · high · `[x]`
   - **Problem:** Escape on a confirm dialog closes the parent too. Examples:
     - "Delete task?" closes the drawer, and EventDetailModal closes along with its delete dialog.
     - The AI panel closes, losing the draft, from rename, edit, the lightbox or the delete dialog.
     - On TaskModal's discard dialog, Escape does nothing.
   - **Fix:** one Escape stack (`src/hooks/useEscapeKey.ts`).
3. **[Tasks/hooks/useTasks.ts:24-47](../src/components/Tasks/hooks/useTasks.ts#L24), `TaskDetail.tsx:128-136`, `Calendar/index.tsx:114,159-163`, `Chat/NewConversationModal.tsx:72-73`, `Chat/hooks/useChat.ts:43`** — States · high · `[~]` (the calendar toggle now shows an error toast; the rest is open)
   - **Problem:** no error toasts in Tasks, Calendar or Chat for mutations. NewConversationModal closes on failure, and failed loads show empty states.
   - **Fix:** catch, `toast.error`, and a separate error state.
4. **[Calendar/MonthView.tsx:221-265](../src/components/Calendar/MonthView.tsx#L221), `components/TaskPill.tsx:61`** — Info/Consistency · med-high
   - **Problem:** the default month view draws its own task pill with no task colour at all; other views show a 2px dot, while the task list tints the whole card.
   - **Fix:** use TaskPill in MonthView and tint with `COLOR_STYLES[color].card`, or add a colour bar.
5. **[Calendar/MonthView.tsx:249-255](../src/components/Calendar/MonthView.tsx#L249), `components/TaskPill.tsx:48`** — States/UX · med · `[x]`
   - **Problem:** the month-view checkbox is never disabled for checklist tasks (throws uncaught), and TaskPill ignores `canEdit`.
   - **Fix:** shared `completionToggle` helper.
6. **[Calendar/DayEventsModal.tsx:76](../src/components/Calendar/DayEventsModal.tsx#L76), `components/sidebar/NextUp.tsx:66`** — States · med · `[x]`
   - **Problem:** TaskPill is rendered without `onToggle`, so the checkbox does nothing.
   - **Fix:** pass the handler.
7. **[Calendar/MonthView.tsx:23,244](../src/components/Calendar/MonthView.tsx#L23), `views/AgendaView.tsx:24,102`, `Tasks/taskColor.ts:66-72`** — Colour · med
   - **Problem:** a red 3px stripe means both "deadline event" and "overdue task". The task palette also offers red, and grey tint looks disabled.
   - **Fix:** mark overdue with an icon or text; reconsider red/grey in the palette.
8. **[Calendar/MonthView.tsx:39,97,227](../src/components/Calendar/MonthView.tsx#L39)** — Mobile/Layout · med
   - **Problem:** 120px rows can't fit 3 events plus 2 tasks, so pills spill into the next week or overlap "+N more".
   - **Fix:** size rows to content, or count task slots into the overflow.
9. **[Tasks/hooks/useTasks.ts:40](../src/components/Tasks/hooks/useTasks.ts#L40), `TaskRow.tsx:116`, `Common/Layout.tsx:316,332,348`** — Indicators · med
   - **Problem:** opening Tasks acknowledges everything, so the unread dot is never seen. The three red header badges mean three different things.
   - **Fix:** acknowledge per task when opened; one "needs you" colour.
10. **[Calendar/components/sidebar/AwaitingResponse.tsx:35](../src/components/Calendar/components/sidebar/AwaitingResponse.tsx#L35) via `Calendar/index.tsx:114,393-402`** — States · med · `[x]` (sidebar uses the badge's 30-day unfiltered window)
    - **Problem:** the sidebar is derived from the visible, filtered range, so it disagrees with the header badge.
    - **Fix:** fetch the sidebar data independently.
11. **[Calendar/index.tsx:269,416](../src/components/Calendar/index.tsx), `sidebar/TeamCalendars.tsx:33`** — UX · med
    - **Problem:** enabling a teammate shows a coloured square but nothing on the grid.
    - **Fix:** draw busy blocks, or rename the section.
12. **[Calendar/EventDetailModal.tsx:297-323](../src/components/Calendar/EventDetailModal.tsx#L297)** — UX · med · `[x]` (creator can edit; recurring series timing stays read-only)
    - **Problem:** events can't be edited (`updateEvent` is exported but unused).
    - **Fix:** an Edit action that reuses NewEventModal.
13. **[Tasks/TaskDetail.tsx:358](../src/components/Tasks/TaskDetail.tsx)** — States/UX · med · `[x]` (saves on blur/Enter)
    - **Problem:** the due-date input saves on every `onChange`, so typing a year fires four writes.
    - **Fix:** save on blur or confirm.
14. **[Documents/components/DocumentListTable.tsx:167](../src/components/Documents/components/DocumentListTable.tsx#L167), `Cashflow/Invoices/InvoiceTable.tsx:263`, `Supervision/WorkLogs/index.tsx:306`, `General/Projects/MilestoneTimeline.tsx:122`** — Dark mode/specificity · med
    - **Problem:** ~10 ghost Buttons pass `text-red-600` via `className`, but Button's `dark:text-gray-200` outranks it.
    - **Fix:** a `ghost-danger` / icon-tone variant.
15. **[ui/Toast.tsx:9](../src/components/ui/Toast.tsx#L9)** — Contrast · med · `[x]` (now `bg-amber-500 text-gray-900`)
    - **Problem:** warning toasts are white on `bg-yellow-500` (~2:1).
    - **Fix:** `bg-amber-600`, or dark text.
16. **Hardcoded or broken strings** — `Calendar/views/_shared/TimelineColumn.tsx:251`, `Common/Layout.tsx` (header aria-labels, "Menu"), `Auth/LoginForm.tsx:178,199,267`, `Common/PageFallback.tsx:7`, `Documents/components/CategoryRow.tsx:47`, `CategoryTree.tsx:71`, `Tasks/TaskDetail.tsx:406-407`, `Calendar/components/ParticipantPicker.tsx:89` — i18n · med
    - **Problem:** "+N more" in English; mixed-language header; English login placeholders and no language switcher on the login page. `common.remove` and `profiles.title` are missing from the locale files, so their raw keys show.
    - **Fix:** locale keys; add the missing keys.
17. **[AiChat/lib/labels.ts:53-55](../src/components/AiChat/lib/labels.ts#L53)** — i18n · med
    - **Problem:** the AI assistant is Croatian-only by decision, so English users get a Croatian panel.
    - **Fix:** revisit; the 43 labels are already centralised.
18. **[Documents/utils/entityHelpers.ts:24-31](../src/components/Documents/utils/entityHelpers.ts#L24)** — Info · med
    - **Problem:** `unit` and `customer` associations show an 8-character UUID fragment, and both are the same orange.
    - **Fix:** add lookups (or hide them) and use distinct colours.
19. **Clickable divs with no keyboard access** — `Documents/components/CategoryRow.tsx:33`, `CategoryTree.tsx:57`, `Tasks/components/AttachmentList.tsx:123`, `Documents/components/FilePickerField.tsx`, `Tasks/TaskDetail.tsx:326-329`, `Calendar/MonthView.tsx:71` — A11y · med
    - **Problem:** document category (a required field), the dropzones and task title editing can't be reached by keyboard.
    - **Fix:** buttons, or role + tabIndex + key handlers.
20. **Hover-only actions** — `AiChat/AiChatMessage.tsx:122,186`, `AiChatHeader.tsx:162,174`, `Tasks/TaskRow.tsx:165`, `Tasks/components/SubtaskList.tsx:199` — Mobile/A11y · med
    - **Problem:** AI edit/regenerate and session actions are hover-only on phones. Task actions hide from keyboard focus.
    - **Fix:** `opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100`.
21. **[Tasks/TaskDetail.tsx:615](../src/components/Tasks/TaskDetail.tsx), `components/AttachmentList.tsx:193`** — Rules/UX · med · `[x]` (both confirm first)
    - **Problem:** comment and attachment deletes are one click with no confirmation, while subtask removal asks.
    - **Fix:** confirm or undo.
22. **[ui/Modal.tsx](../src/components/ui/Modal.tsx), [ui/ConfirmDialog.tsx](../src/components/ui/ConfirmDialog.tsx)** — A11y · med · `[x]` (dialog roles, `useFocusTrap`, labelled close button; also the task drawer, password dialog, lightbox and Retail milestone overlay)
    - **Problem:** no `role="dialog"`, `aria-modal` or focus management; the close X has no accessible name; the TaskDetail drawer has no focus handling.
    - **Fix:** dialog semantics, focus trap and restore, aria-label.
23. **Calendar on phones** — `Calendar/hooks/useCalendarPreferences.ts:16`, `MonthView.tsx:269,279`, `views/WeekView.tsx` — Mobile · med
    - **Problem:** the month view is the default on every device, and ~50px columns are unreadable at 400px.
    - **Fix:** default to Agenda below `md`, or a phone dot view.
24. **[Calendar/NewEventModal.tsx:474-479](../src/components/Calendar/NewEventModal.tsx#L474)** — Rules/Library · low-med
    - **Problem:** "Private" is a bare checkbox under a ToggleSwitch. There is no discard confirmation, and three different selected-chip styles.
    - **Fix:** `ToggleSwitch`, TaskModal's dirty guard, `FilterChip`.
25. **[Tasks/index.tsx:384-387](../src/components/Tasks/index.tsx)** — States · low-med
    - **Problem:** tab counts include completed tasks even when they're hidden.
    - **Fix:** count what's visible.
26. **[ui/Pagination.tsx:20](../src/components/ui/Pagination.tsx#L20) + `General/ActivityLog/index.tsx:167`** — i18n · low-med
    - **Problem:** the English UI shows "…of 320 stavki".
    - **Fix:** default the label through `t()`.
27. **[ui/Alert.tsx:26,34-47](../src/components/ui/Alert.tsx#L26) + `Sales/Customers/forms/CustomerFormModal.tsx:117`** — Library · low-med · `[~]` (CurrencyInput `required` fixed; DateInput already passed it; Alert/StatCard/DateInput min-max open)
    - **Problem:** Alert ignores `onClose`; StatCard `trend`, DateInput `min` / `max` and CurrencyInput `required` are ignored too.
    - **Fix:** implement the props or remove them.
28. **[Chat/MessagePanel.tsx:322-331](../src/components/Chat/MessagePanel.tsx#L322)** — Library/UX · low-med
    - **Problem:** three composers behave differently: auto-grow, Enter vs Ctrl+Enter, and no shortcut hints.
    - **Fix:** one shared composer.
29. **[Tasks/TaskDetail.tsx:389-476,494,553,570,684](../src/components/Tasks/TaskDetail.tsx)** — Library · low
    - **Problem:** a different assignee picker in create vs edit; four heading sizes in one drawer; a raw textarea and buttons.
    - **Fix:** one picker and one section-label style.
30. **[Common/Layout.tsx:440,541,578-591](../src/components/Common/Layout.tsx)** — UX/Library · low
    - **Problem:** the desktop sidebar collapses on every menu click and isn't persisted. The Cashflow password dialog is hand-rolled with Confirm/Cancel reversed.
    - **Fix:** persist the sidebar state; use Modal.

### Systemic patterns

- **Hand-rolled primitives.**
  - ~18 raw `bg-blue-600 text-white` buttons.
  - 4 modal-footer styles.
  - Hand-rolled search fields in Documents and Calendar.
  - Mixed page-header approaches.
  - 5 loading-indicator styles.
- **People drawn at least six ways:** AvatarStack, 56px initials, 32px comment avatars, GroupMembersPanel initials, a generic User icon, and names with no avatar.
- **Attachments have four implementations** with different limits; `formatFileSize` is copied three times.
- **Date and time drift.**
  - Hardcoded "5m/3h/2d".
  - Browser-locale times.
  - Fixed `dd.MM.yyyy HH:mm`.
  - `toLocaleString` giving MM/DD/YYYY in English.
  - DD/MM/YYYY with slashes.
  - 60 native `type="date"` inputs vs 11 `DateInput`.
- **Semantic colour drift.**
  - Reminder is amber vs yellow.
  - "Pending" is grey vs amber.
  - "Unread" is red, blue or amber.
  - Pill radius varies.
  - Badge has duplicate variants and no `error` / `info`.
- **Icon-only buttons without labels (~12).**
- **`ui/` focus styling inconsistent.** Inputs have rings; Button, FilterChip, SegmentedControl, Tabs, Pagination and the Modal close button have none. Tabs lacks `role="tab"`.
- [x] **`FormField` labels aren't linked to inputs (419 usages),** and error text has no dark variant. *Fixed: FormField context links label, error and helper text to Input/Select/Textarea/SearchableSelect; `group` for the 9 group fields.*
- **`docs/UI.md` is stale:**
  - ConfirmDialog labels are already `t()`.
  - PageHeader doesn't accept `subtitle` / `icon`.
  - Pagination returns null only when the count is 0.
  - AvatarStack defaults to `xs`.
- **Terminology collision:** the Director dashboard's "Overdue tasks" card counts overdue **milestones**.

### App-wide sweep (all of `src/`)

- **`window.confirm(` / bare `confirm(`:** 0.
- **`alert(`:** 0.
- **Tailwind classes built by template interpolation:** 0 (the only hit is the explanatory comment in `taskColor.ts`).
- **Side border colour + `dark:border-*` on the same element:** 0 remaining. `SupervisionWeekView.tsx:35` and `WorkLogs/index.tsx:278` set the colour via inline `borderLeftColor`, which wins. The live variant of this bug class is the ghost-Button override (finding 14).
- **`bg-white` with no `dark:bg-` on the same line:** 3 of 268, all fine.

### Good patterns worth copying

- **TaskModal's close guard** (dirty check + discard ConfirmDialog), and the app-wide `useUnsavedChanges` / `useLeaveGuard`.
- **SubtaskList's `run()`:** optimistic update, rollback on failure, and an inline error instead of a silent revert.
- **DocumentUploadModal:** FormField errors, toasts, honest partial success.
- **`taskColor.ts`:** a closed palette of literal class names.
