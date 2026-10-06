# Backlog — before the next release

Work that is not new code: fixes that are written but not live, and checks nobody has run yet.
Do these before anything else in the backlog. No ids; tick an item off and date it. Rules are in
[README.md](./README.md).

- [ ] **Apply the twelve pending migrations, in order, with the merge of `fix/backlog-batch-2`.**
  - UI audit: `20260915120000_invoice_list_server_sort`, `20260916100000_lock_down_finance_definer_functions`,
    `20260917100000_payment_update_balance_triggers`.
  - `fix/defect-backlog`: `20260930100000_security_hardening`, `20260930100100_auth_user_created_trigger`,
    `20260930100200_sales_price_and_sale_rpc`, `20260930100300_cashflow_balances_and_stats`,
    `20260930100400_funding_rename_and_tic_writes`.
  - Batch 2: `20261001100000_company_statistics_direction`, `20261001100100_credit_monthly_debt_service`,
    `20261001100200_phase_budget_used_contract_status`, `20261001100300_seed_izvodaci_document_category`.
  - The docs record these as not applied (as of 2026-10-01); confirm against each database. Until
    they are applied, the fixed High security items are still open in production: `public.users`
    readable without login (SEC-A1), any user able to create a Director row (SEC-A2),
    `get_filtered_invoices` bypassing invoice RLS, `company_statistics` bypassing RLS (SEC-A11).
- [ ] **Walk [../test/11-pre-merge-ui-audit.md](../test/11-pre-merge-ui-audit.md).** 80 unticked
  checks, over a dozen marked blocker. Steps 0.4 and 0.5 follow the migrations directly: log in as
  Sales and Supervision and open the invoice screens; edit an existing payment's amount and bank
  account and check the balance follows.
- [ ] **Check bank accounts that were already wiped** by the opening-balance bug (CASH-1) and the
  company-save bug (CASH-16), using the query at the end of migration `20260930100300`. Affected
  accounts show `balance_reset_at` on the day the company was last edited. The code fix stops new
  damage; it does not repair these.
- [ ] **Try TIC saves on dev** once `20260930100400` is applied: a first-time save, and a save as
  Accounting and as Investment (FUND-2). The fix was made from reading the code.
- [ ] **Run drift check 2 from migration `20260917100000`** after the cesija sign is decided
  (CASH-6 in [cashflow.md](./cashflow.md)).
