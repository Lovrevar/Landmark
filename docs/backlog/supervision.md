# Backlog — Supervision

Site management, subcontractors, contracts, phases and work logs. Ids: `SUP-n` (next free:
`SUP-19`). Entry format and rules are in [README.md](./README.md).

Supervision is used on phones on site; the mobile problems are UI-8 in [ui.md](./ui.md). The
payment gate being screen-only is SEC-004 in [security.md](./security.md).

## Open

### SUP-18 · Low · "Contract value" and "work logs this week" mean different things on different screens
- **Check:** Code reading (Step 7 item 1, 2026-10-21). The sums are now one function,
  `contractTotals` in `src/utils/constructionFigures.ts`, called by the General report and Budget
  Control. What differs is which contracts go in
- **Where / what happens:**
  - Contract value:
    - The General report sums every contract, draft and terminated ones included.
    - Budget Control first counts a terminated contract at what was paid on it
      (`budgetControlService.ts` ~66, `contractRollup.committedAmount`), as Site Management does.
    - The Director dashboard sums active and completed contracts only (`directorService.ts` ~366).

    One portfolio can show three "contract values".
  - Work logs: the General report counts today and the six days before ("7 days"). The Supervision
    dashboard counts the calendar week, Monday to Sunday (`supervisionService.ts` ~32).
  - Milestones: settled is `paid` everywhere except EVM, which counts `completed` as done too
    (known, GEN-8).
- **Fix direction:** Step 7 item 3. Run every contract total through `committedAmount` and decide
  whether drafts count. Name the work-log window on each screen.

### SUP-17 · Medium · Subcontractor documents offer delete to users who cannot delete
- **Check:** Code reading (pre-release review, 2026-10-20)
- **Where:** `Supervision/SiteManagement/ContractDocumentViewer.tsx:139` shows the delete button
  whenever `!readOnly`; used without `readOnly` from `Subcontractors/SubcontractorDocumentsSection.tsx:41`
  and `SiteManagement/modals/EditSubcontractorModal.tsx:422`
- **What happens:** since SEC-A12 only the uploader, Director and Accounting may delete a document.
  A Supervision or Sales user sees the bin on every document, including e-mailed ones and other
  people's uploads; RLS refuses, `assertRowsAffected` throws and they get the generic
  "delete_error" toast. No data is lost. `Documents/index.tsx:44` already gates it correctly.
- **Fix direction:** reuse the Documents screen's rule (uploader, Director or Accounting) per row
  inside the viewer, or move it to `src/utils/permissions.ts` and use it in both.

### SUP-16 · Low · Site management card: the "kasni" badge runs past the card edge
- **Check:** Confirmed (in `help-kb/img/upravljanje-gradilistem.png`, before and after 2026-10-20)
- **Where:** `Supervision/SiteManagement/ProjectsGrid.tsx:90`, the badge row
- **What happens:** at 1280px a card with status, category, phase count and overdue badges
  (Rezidencija Jarun on LandmarkDemo) pushes the red "1 kasni" past the card's right edge.
- **Fix direction:** `flex flex-wrap items-center gap-2` instead of `flex items-center space-x-2`,
  then retake the `upravljanje-gradilistem` help shot.

### SUP-14 · Low · Supervision wording
- The subtitles of Supervision payments and invoices describe something the pages do not do.
- Spellings: "podizvodjač" (approvals), "odobrivanje", "podizvođača"; "Izvozi izvještaj".
- The `work_logs.*` locale block looks unused.

### SUP-5 · Low · The by-classification view has no add or budget buttons
- The "+" on a classification row now preselects it; the view itself still offers no way to add
  a contract or set a budget.

### SUP-7 · Low · Financing is stored on the company, not the contract
- `financed_by_*` is set only when creating a new subcontractor, and only banks are offered.

### SUP-12 · Low · Payment history repeats the accounting note on every row
- **Where:** `src/components/Supervision/SiteManagement/modals/PaymentHistoryModal.tsx`.
- **Fix direction:** say "managed in accounting" once, in the header.

### SUP-11 · Low · Dead code
- `check_subcontractor_budget_integrity()` references the non-existent `contracts.budget_planned`.
- Supervision invoices filter on `invoice_category IN ('SUBCONTRACTOR','SUPERVISION')`;
  `SUPERVISION` is not a valid category.
- Unused: `linkSubcontractorToPhase`, `getContractCount`, `createSubcontractor`,
  `fetchSubcontractorInvoiceStats`, `fetchMilestonesBySubcontractor`, `updateMilestoneStatus`,
  `recalculateAllPhaseBudgets` (no UI caller).
- Before deleting, grep every exported symbol; see [../GRAPHIFY.md](../GRAPHIFY.md) on why "no
  inbound import" is not proof.

## Resolved

### SUP-13 · Low · Work logs and Subcontractors show their actions to every role
- Fixed on `fix/backlog-small-batch` (2026-10-08): Work logs use `canManageWorkLogs`; Subcontractors use
  `canManageSubcontractors` (now including Accounting, as the policy does) and
  `canDeleteSubcontractors`.

### SUP-15 · Low · Header buttons of an opened project are clipped on a laptop
- Fixed on `feat/user-guidance-phase-2` (2026-10-07): the header row in `ProjectDetail.tsx` wraps
  under the title instead of squeezing its buttons.
