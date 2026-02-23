/*
  # Link OUTGOING_BANK Invoices to Credit Allocations

  ## Summary
  Adds a direct foreign-key link from OUTGOING_BANK invoices to a specific
  credit allocation, so that when funds are disbursed from an investor credit
  to a company bank account the correct allocation is debited automatically.

  ## Changes

  ### 1. New Column on accounting_invoices
  - `credit_allocation_id` (uuid, nullable) – references `credit_allocations(id)`.
    Only populated for OUTGOING_BANK invoices that draw from an allocation.

  ### 2. DB Trigger: update allocation used_amount on OUTGOING_BANK invoices
  - On INSERT of an OUTGOING_BANK invoice with `credit_allocation_id` set:
      adds `total_amount` to that allocation's `used_amount`.
  - On DELETE:  subtracts `total_amount` from `used_amount`.
  - On UPDATE:  handles amount changes and allocation reassignments.

  ## Security
  - Uses SECURITY DEFINER so the trigger can bypass RLS when updating
    credit_allocations.
*/

-- 1. Add the column
ALTER TABLE accounting_invoices
  ADD COLUMN IF NOT EXISTS credit_allocation_id uuid
    REFERENCES credit_allocations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_credit_allocation_id
  ON accounting_invoices(credit_allocation_id)
  WHERE credit_allocation_id IS NOT NULL;

-- 2. Trigger function
CREATE OR REPLACE FUNCTION update_credit_allocation_used_amount_from_invoice()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- INSERT: add invoice amount to allocation used_amount
  IF TG_OP = 'INSERT' THEN
    IF NEW.invoice_type = 'OUTGOING_BANK' AND NEW.credit_allocation_id IS NOT NULL THEN
      UPDATE credit_allocations
      SET used_amount = COALESCE(used_amount, 0) + NEW.total_amount,
          updated_at  = now()
      WHERE id = NEW.credit_allocation_id;
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE: subtract invoice amount from allocation used_amount
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_type = 'OUTGOING_BANK' AND OLD.credit_allocation_id IS NOT NULL THEN
      UPDATE credit_allocations
      SET used_amount = GREATEST(0, COALESCE(used_amount, 0) - OLD.total_amount),
          updated_at  = now()
      WHERE id = OLD.credit_allocation_id;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: handle amount changes and/or allocation reassignment
  IF TG_OP = 'UPDATE' THEN
    -- Remove contribution from old allocation
    IF OLD.invoice_type = 'OUTGOING_BANK' AND OLD.credit_allocation_id IS NOT NULL THEN
      UPDATE credit_allocations
      SET used_amount = GREATEST(0, COALESCE(used_amount, 0) - OLD.total_amount),
          updated_at  = now()
      WHERE id = OLD.credit_allocation_id;
    END IF;

    -- Add contribution to new allocation
    IF NEW.invoice_type = 'OUTGOING_BANK' AND NEW.credit_allocation_id IS NOT NULL THEN
      UPDATE credit_allocations
      SET used_amount = COALESCE(used_amount, 0) + NEW.total_amount,
          updated_at  = now()
      WHERE id = NEW.credit_allocation_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_allocation_from_outgoing_bank_invoice
  ON accounting_invoices;

CREATE TRIGGER trigger_update_allocation_from_outgoing_bank_invoice
  AFTER INSERT OR UPDATE OR DELETE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_allocation_used_amount_from_invoice();
