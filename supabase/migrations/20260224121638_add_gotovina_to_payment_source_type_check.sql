/*
  # Add 'gotovina' to accounting_payments payment_source_type check constraint

  ## Changes
  - Drops the existing check constraint on `payment_source_type`
  - Recreates it with 'gotovina' as an allowed value

  ## Allowed values after migration
  - bank_account
  - credit
  - kompenzacija
  - gotovina
*/

ALTER TABLE accounting_payments
  DROP CONSTRAINT IF EXISTS accounting_payments_payment_source_type_check;

ALTER TABLE accounting_payments
  ADD CONSTRAINT accounting_payments_payment_source_type_check
  CHECK (payment_source_type IN ('bank_account', 'credit', 'kompenzacija', 'gotovina'));
