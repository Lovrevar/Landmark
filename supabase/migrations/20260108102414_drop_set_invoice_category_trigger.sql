/*
  # Drop outdated set_invoice_category trigger

  This trigger was overwriting the user-selected category with hardcoded values
  like 'SUPPLIER', 'CUSTOMER', 'OFFICE' based on the entity IDs.

  Now that we have a proper invoice_categories table and users can select
  categories from a dropdown, this trigger is no longer needed and was
  preventing the selected category from being saved.

  ## Changes
  - Drop the trigger `set_invoice_category_trigger` on accounting_invoices
  - Drop the function `set_invoice_category`
*/

DROP TRIGGER IF EXISTS set_invoice_category_trigger ON accounting_invoices;

DROP FUNCTION IF EXISTS set_invoice_category();
