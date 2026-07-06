# Manual Smoke Testsheet

> A quick end-to-end pass to confirm the core money loop works:
> **make an invoice → see it on the dashboard → pay it → check the account/payment landed.**
> Run top-to-bottom; it should take ~10–15 minutes. Tick each box and note anything that
> looks wrong in the **Notes** column.

**Build/env:** ______________  **Date:** ______________  **Tester:** ______________

---

## 0. Login & setup

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 0.1 | Open the app, log in | Lands on the dashboard for your default profile | ☐ | |
| 0.2 | Open the profile switcher | All profiles you have access to are listed | ☐ | |
| 0.3 | Switch to **Cashflow** profile, enter the password | Cashflow menu (Invoices, Payments, Banks, Companies…) loads | ☐ | |

---

## 1. Create an invoice (Cashflow → Invoices)

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 1.1 | Open **Invoices**, click **New invoice** | Invoice form modal opens | ☐ | |
| 1.2 | Pick a company, supplier/customer, type & direction | Entity fields update to match the chosen type | ☐ | |
| 1.3 | Enter invoice number, issue date, due date | Dates accepted; due date can differ from issue | ☐ | |
| 1.4 | Add a base amount with **one VAT rate** | VAT summary computes VAT + gross correctly | ☐ | |
| 1.5 | Add a **second VAT rate row** (multi-VAT) | Totals re-sum across both rows correctly | ☐ | |
| 1.6 | Save | Modal closes, invoice appears in list as **Unpaid** | ☐ | |
| 1.7 | Check the list totals (unpaid amount) | Unpaid total increased by the new invoice's gross | ☐ | |
| 1.8 | Search for the new invoice number | Filters down to the single invoice | ☐ | |

---

## 2. Check the dashboard reflects it

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 2.1 | Go to the **Cashflow / Accounting dashboard** | Loads without errors | ☐ | |
| 2.2 | Check cash-flow / outgoing (or VAT) KPI | Reflects the new invoice (amount or VAT shows up) | ☐ | |
| 2.3 | Check "top companies" / monthly trend chart | New invoice's company/month is represented | ☐ | |
| 2.4 | (Director profile) open **Director dashboard** | Financial metrics (payables/receivables) shift accordingly | ☐ | |

---

## 3. Pay the invoice (Cashflow → Invoices or Payments)

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 3.1 | On the invoice row, click **Pay** / record payment | Payment form opens, pre-filled with the invoice | ☐ | |
| 3.2 | Choose source = **bank account**, enter amount = full gross | Amount accepted | ☐ | |
| 3.3 | Set payment date, save | Modal closes | ☐ | |
| 3.4 | Re-check the invoice status | Now shows **Paid** (or Partial if you paid less) | ☐ | |
| 3.5 | Try a **partial payment** on another invoice | Status becomes **Partial**, remaining balance correct | ☐ | |

---

## 4. Verify the payment & account

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 4.1 | Open **Payments** | The new payment appears in the list | ☐ | |
| 4.2 | Check the payment stats cards | Totals include the new payment | ☐ | |
| 4.3 | Open the payment detail view | Method, amount, linked invoice & company all correct | ☐ | |
| 4.4 | Filter Payments by method = bank / date range | Payment shows under the right filter | ☐ | |
| 4.5 | Open **Banks / Companies**, check the relevant account | Account balance / movements reflect the payment | ☐ | |
| 4.6 | Back on the dashboard, re-check KPIs | Outgoing/paid figures now include the payment | ☐ | |

---

## 5. Quick checks on the other main modules

> Just confirm each module loads and one basic action works — don't go deep.

| # | Module | Step | Expected | ✓ | Notes |
|---|---|---|---|---|---|
| 5.1 | **Sales** | Open unit/apartment list, open a customer | List + detail load, payments visible | ☐ | |
| 5.2 | **Supervision** | Open Site Management, open a subcontractor | Contracts/phases load, work logs visible | ☐ | |
| 5.3 | **Funding** | Open credits/investors, open the TIC view | Equity/debt split and allocations render | ☐ | |
| 5.4 | **Retail** | Open retail projects / buyers | List loads, overdue invoices shown | ☐ | |
| 5.5 | **Reports** | Generate one PDF (e.g. investment report) | PDF downloads and opens correctly | ☐ | |
| 5.6 | **Calendar** | Open the calendar | Scheduled payments / due dates appear | ☐ | |

---

## 6. Cross-cutting sanity checks

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 6.1 | Switch the UI language (HR ⇄ EN) | Labels translate; Croatian legal terms (cesija, kompenzacija) stay as-is | ☐ | |
| 6.2 | (Director) open **Activity Log** | The invoice create + payment you just made are logged | ☐ | |
| 6.3 | Resize to mobile width | Tables collapse to card view, nav stays usable | ☐ | |
| 6.4 | Open browser dev console during the run | No red errors during the core flow | ☐ | |

---

### Result

- [ ] **PASS** — core money loop (create → dashboard → pay → verify) works end-to-end
- [ ] **FAIL** — blockers found (list below)

**Blockers / follow-ups:**

1.
2.
3.
</content>
</invoke>
