# Cognilion — Manual Testing Cheat Sheet

A walkable checklist for verifying every user-facing feature. Walk it top-to-bottom; tick each line as you go.

> The module sections now live as separate files under [./test/](./test/). This file keeps the preamble and the Table of Contents; each entry below links out to its own section file.

---

## How to use this document

### Status markers

Each test line ends with a single-character marker in parentheses:

| Marker | Meaning |
|---|---|
| `(+)` | Pass — behaved as expected |
| `(-)` | Fail — file a bug with a reference to this line |
| `( )` | Not yet tested |
| `(~)` | Blocked — missing test data, staging unavailable, dependency broken |
| `(N/A)` | Not applicable for the current role/profile |

### Test environment assumptions

Before starting, confirm you have:

- **Staging URL** reachable, with a clean or predictable dataset. Destructive actions (delete, bulk-delete, imports) are listed throughout — **do not run them on production**.
- **Demo accounts** for each of the 5 roles: `Director`, `Accounting`, `Sales`, `Supervision`, `Investment`. Default to `Director` unless a test line requires otherwise.
- **Cashflow profile password** on hand — the Cashflow profile is password-gated.
- **Language** set to English unless the line is inside the Language switcher section of [Foundations](./test/01-foundations.md).
- **Two browser sessions** (e.g. normal + incognito) available for realtime tests (Chat unread badge, Calendar RSVP).
- Sample assets for uploads: a valid PDF (~200 KB), an oversized file (>10 MB), an invalid type (`.exe` or `.zip`), a sample Excel for imports.

### Reading a test line

```
add an invoice with all of the fields entered   (+)
add an invoice with the invoice number missing  ( )
add an invoice with VAT rates that don't sum    ( )
```

Per action group you'll typically find:
- **One golden-path line** — all fields valid
- **One line per required field left empty**
- **One or two invalid-input lines** — bad format, out-of-range, future date, negative number, duplicates, Croatian characters, very long strings
- **One cancel/close line** where relevant (Esc, X button, backdrop)
- **One permission line** for roles/profiles that shouldn't see the feature

### Croatian domain terms

`cesija`, `kompenzacija`, `stan`, `garaža`, `repozitorij`, `TIC`, `OIB` are **kept in Croatian** throughout this doc — do not mentally translate them; they are legally/domain-specific concepts.

### Preconditions

Each action group starts with an italic line listing any preconditions. Example:

> _Role: Director. Profile: Cashflow. Needs: at least one supplier, one company, one project._

---

## Table of Contents

1. [Foundations](./test/01-foundations.md) — auth, profile switcher, language switcher, layout & navigation, shared UI behaviours
2. [Cashflow](./test/02-cashflow.md) — Invoices, Payments, Approvals, Debt Status, Banks, Suppliers, Office Suppliers, Customers, Companies, Loans, Cashflow Calendar
3. [Sales](./test/03-sales.md) — Sales Projects → Buildings → Units, Apartments, Customers, Payments
4. [Retail](./test/04-retail.md) — Projects, Land Plots, Customers, Invoices, Sales
5. [Funding](./test/05-funding.md) — Investors, Investments, Projects, Payments / Disbursements, TIC
6. [Supervision](./test/06-supervision.md) — Site Management, Subcontractors, Work Logs, Invoices, Payments
7. [General, Reports & Dashboards](./test/07-general-reports-dashboards.md) — General → Projects, Budget Control, Activity Log, Reports, Dashboards per profile
8. [Collaboration](./test/08-collaboration.md) — Calendar, Chat, Tasks
9. [Cross-cutting](./test/09-cross-cutting.md) — permissions matrix, Activity Log verification sweep, i18n sweep, release smoke list
10. [Appendix: format conventions recap](./test/10-appendix.md)
