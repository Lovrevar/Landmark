-- Uniqueness: no two invoices for the same (company, counterparty, invoice_number, year).
-- Counterparty = whichever entity FK is set (exactly one is non-null via
-- check_invoice_entity_type). YEAR comes from issue_date.
--
-- Rows with every counterparty column NULL are excluded (NULL <> NULL in
-- unique indexes), which is acceptable because that state is already a
-- CHECK violation.
--
-- Pre-flight: if existing duplicates prevent creation, run the diagnostic
-- SELECT at the bottom of this file and remove or re-number the offenders.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_invoice_number_per_company_counterparty_year
  ON accounting_invoices (
    company_id,
    COALESCE(
      supplier_id,
      customer_id,
      office_supplier_id,
      bank_id,
      retail_supplier_id,
      retail_customer_id
    ),
    invoice_number,
    EXTRACT(YEAR FROM issue_date)
  );

-- Diagnostic (run manually if index creation fails with a uniqueness error):
-- SELECT company_id,
--        COALESCE(supplier_id, customer_id, office_supplier_id, bank_id,
--                 retail_supplier_id, retail_customer_id) AS counterparty,
--        invoice_number, EXTRACT(YEAR FROM issue_date) AS yr, COUNT(*)
-- FROM accounting_invoices
-- GROUP BY 1, 2, 3, 4 HAVING COUNT(*) > 1;
