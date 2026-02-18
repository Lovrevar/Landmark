/*
  # Add Kompenzacija as a payment source type

  ## Changes
  - Updates the `accounting_payments_payment_source_type_check` constraint on `accounting_payments` 
    to allow 'kompenzacija' as a valid payment source type, in addition to 'bank_account' and 'credit'

  ## Notes
  - Kompenzacija payments do not deduct from any bank account or credit line
  - They simply mark the invoice as paid via a compensation/offset mechanism
  - Both `company_bank_account_id` and `credit_id` will be NULL for kompenzacija payments
*/

ALTER TABLE accounting_payments
  DROP CONSTRAINT IF EXISTS accounting_payments_payment_source_type_check;

ALTER TABLE accounting_payments
  ADD CONSTRAINT accounting_payments_payment_source_type_check
  CHECK (payment_source_type = ANY (ARRAY['bank_account'::text, 'credit'::text, 'kompenzacija'::text]));
