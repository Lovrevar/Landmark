# Visual check — user guidance phase 1

**Date:** 2026-10-05 · **Branch:** `feat/user-guidance-phase-1` · **Tool:** Playwright (Chromium), 1440×900 and 390×844

## What this was run against

There is no Docker on the machine the check ran on, so no local Supabase. The frontend was built
from this branch against **LandmarkDemo** — the seeded showcase project with fabricated data
(`docs/DEMO_ENVIRONMENT.md`), not production — and logged in as its Director, Accounting, Sales and
Supervision users.

- **Nothing was written to that project.** The only writes the check would have made are
  activity-log rows (login, help usage); they were answered in the browser and never sent. No
  form was submitted and the TIC edits were not saved.
- **No migration was applied.** LandmarkDemo is at `20260917100000`. Two things therefore differ
  from a released system:
  - The Companies cards' **financing line needs migration `20261005120000`**. The two columns it
    reads were added to the response in the browser, with made-up amounts. The screenshots show
    the layout, not real figures, and the cards' other numbers still come from the old view.
  - The Activity Log's help-usage checkbox needs migration `20261005100000` and was not checked.
- The demo data has no phased TIC, so a phase split and a mismatch were created on screen (unsaved)
  to show the triangle. It has nothing due in October 2026, so the calendar is shown for July 2026.

## Files

| Pattern | What |
|---|---|
| `help-index-<role>-<width>` | `/help` for each role — the lists differ by role |
| `help-search-*`, `help-search-empty-*`, `help-article-*`, `help-article-not-for-role-*` | Search, no results, an article, an article hidden from the role |
| `topbar-help-*`, `pageheader-help-*`, `help-for-page-*` | The two "?" links and where the page one lands |
| `profile-switcher-<role>-<width>` | Desktop dropdown / mobile drawer. Cashflow is offered to Director and Accounting only; Supervision has no switcher |
| `hint-evm-{cpi,spi,eac,vac}-*` | Budget Control |
| `hint-invoice-type-*`, `invoices-list-*` | Invoice type legend |
| `payment-form-*`, `hint-payment-source-*`, `hint-cesija-*` | Both payment forms |
| `tic-*`, `hint-tic-phases-*`, `hint-tic-mismatch-*` | TIC |
| `hint-allocations-*` | Credit allocations |
| `companies-cards-financing-*` | Companies cards with the financing line (mocked columns, see above) |
| `general-report-cash-flow-*`, `general-report.pdf`, `general-report-pdf-page-9.png` | Operating / financing tables on screen and in the PDF |
| `cashflow-calendar-*` | Calendar: current month, and July 2026 |
| `apartment-import-modal-*`, `predlozak-uvoz-stanova-*.xlsx`, `apartment-import-template-xlsx.png` | Import modal, the downloaded template, and its two sheets rendered as tables |
| `en-*` | The same screens with the UI in English |
| `pageheader-investitori-desktop`, `pageheader-dobavljaci-desktop`, `pageheader-sales-projekti-buildings-desktop`, `pageheader-sales-projekti-garages-desktop` | The three-button page headers, added 2026-10-06 (see "Page headers with three or more buttons") |

## Automated checks on every screenshot

Horizontal page overflow, raw i18n keys in the page text, popovers or dialogs extending outside the
viewport, console errors, a missing "Više u pomoći" link in a hint, and whether Escape on a hint
inside a modal closes only the hint.

## Findings

### Found and fixed during the check

1. **Page header squeezed on Cashflow → Invoices (desktop).** With five action buttons the title
   column was ~90px wide: the description wrapped onto four lines and the new "?" dropped under the
   title. `PageHeader` now keeps a 14rem title column and lets the actions wrap. Side effect to look
   at: on that page the buttons now take three rows (`invoices-list-desktop`).
2. **Invoice type legend unreachable on phones.** It lived in the table header, which the mobile
   card view hides. It now also sits beside the type filter below 768px (`hint-invoice-type-mobile`).
3. **Invoice type legend wrapped badly.** Long labels broke over two lines in a 288px popover; that
   one is wider now.
4. **Help search ranked "Kontrola proračuna" first for "račun".** A word that starts with the
   query now outranks one that merely contains it.
5. **Companies financing line** wrapped its two amounts onto separate lines; they stay together now.
6. **General report totals on a phone** broke "€" from "−3,0M"; each figure stays whole now.
7. **General report PDF**: the first row of each cash-flow table touched the header band; 3mm added.

### Still open — not caused by this branch as far as the code shows

Now tracked in `docs/backlog/`: finding 8 is FUND-16, 9 is CASH-21, 10 is GEN-18, 11 is GEN-19,
12 is CASH-22 and 13 is CASH-23. Findings 9, 12 and 13 are fixed on
`fix/budget-diff-and-decimals`. The blank Sales project page noted below is SALES-15.

8. **TIC page scrolls sideways.** At 390px the whole page is 973px wide (1262px with phase columns);
   at 1440px it overflows once two phase columns are added (1530px). The table should scroll inside
   its card (`tic-table-mobile`, `tic-row-mismatch-desktop`).
9. **Companies stat cards clip on a phone.** "€1.287.631,05" and "€−7.088.981,45" run past the
   edge of their cards in the two-column grid (`companies-cards-financing-mobile`).
10. **General report PDF, trend chart**: the area under the line is filled almost black, and the
    chart's month labels sit directly on the "ANALIZA NOVČANOG TOKA" heading
    (`general-report-pdf-page-9`).
11. **Hardcoded company name.** "LANDMARK GROUP" in the General report header and PDF footer, and
    "…svih firmi pod Landmarkom" under Moje firme, appear on the demo instance too.
12. **Ragged decimals on the Companies cards** ("€2.715.147,7", "€3.172.708,8"). The new financing
    line follows the card's existing formatting; the money-formatting sweep (UI-1 in `docs/backlog/ui.md`)
    has not reached this screen.
13. **Calendar "Razlika od budžeta"** shows €1.691.590 "(Preko budžeta - loše)" as a positive
    amount.

### Not app issues

14. The file picker in the import modal reads "Choose File / No file chosen": that is the
    browser's own control in the test browser's language.
15. Console showed `JWT issued at future` once or twice — clock skew between this machine and the
    demo project — and `Failed to fetch` from requests cut off by navigation.

### Checked and fine

- Role filtering on `/help`: Director and Accounting 62 articles, Sales 47, Supervision 22; a
  Cashflow article opened directly by Sales shows "Članak nije dostupan".
- Every hint opens inside the viewport at both widths, has its "Više u pomoći" link, and inside
  the payment modal Escape closes the hint and leaves the modal open.
- No raw translation keys anywhere. English UI: hints, the Help page (with its "Croatian only"
  note), the import instructions and the report headings are translated; article titles are
  Croatian by design.
- Template: sheet `Stanovi` with 26 headers A–Z, sheet `Upute` with the 11 instruction lines.

## Page headers with three or more buttons (added 2026-10-06)

`PageHeader` was changed during the check (finding 1). Four pages pass it three or more buttons.
All were looked at at 1440×900 on LandmarkDemo, with the branch as frozen; nothing was changed.

| Page | Buttons | Button rows | Header height | Verdict |
|---|---|---|---|---|
| Cashflow → Računi | 6 (Polja + five) | 3 | taller than before | Title and description readable again; the buttons wrap, with "Polja" alone on the first row. Better for the text, worse for height — the one page where the change is visible (`invoices-list-desktop`) |
| Funding → Investitori | 3 | 1 | 56px | Same as before the change (`pageheader-investitori-desktop`) |
| Cashflow → Dobavljači | 3 | 1 | 56px | Same as before (`pageheader-dobavljaci-desktop`) |
| Sales projekti, buildings view | 3 | 1 | 56px | Same as before (`pageheader-sales-projekti-buildings-desktop`) |
| Sales projekti, units view, Garaže tab | 3 | 1 | 56px | Same as before (`pageheader-sales-projekti-garages-desktop`) |

**None of the three-button pages got worse.** Their buttons fit beside the title on one row, so
the new wrapping never engages. Only Računi, with six, wraps.

One more pre-existing thing seen on the way: Sales projekti → a project with no buildings
(Kvart Črnomerec on the demo data) shows an empty page under "Natrag na projekte" — no empty state
saying there are no buildings yet (`pageheader-sales-projekti-buildings-desktop`).
