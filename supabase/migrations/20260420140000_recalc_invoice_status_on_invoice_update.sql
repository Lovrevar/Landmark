/*
  # Recalculate invoice status on invoice update

  ## Problem
  When a user edits an invoice and changes its totals (e.g. increases base_amount_*),
  the existing `calculate_invoice_amounts` BEFORE trigger recalculates
  `total_amount` and `remaining_amount` but deliberately leaves `status` alone.

  Result: an invoice that was `PAID` (paid_amount == old total_amount) stays
  `PAID` even after the new total exceeds paid_amount. It should flip to
  `PARTIALLY_PAID`. The inverse (new total <= paid_amount) should flip to
  `PAID`.

  ## Solution
  Recalculate `status` from `NEW.paid_amount` vs `NEW.total_amount` inside
  `calculate_invoice_amounts`. Safe for the payment-trigger path too: when
  `update_invoice_payment_status` UPDATEs paid_amount/status, this BEFORE
  trigger will compute the same status from the incoming paid_amount — no
  conflict, no divergence.

  Also backfills any invoices that are currently out of sync (status doesn't
  match paid_amount vs total_amount).
*/

CREATE OR REPLACE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate VAT amounts for each rate
  NEW.vat_amount_1 := ROUND(COALESCE(NEW.base_amount_1, 0) * 0.25, 2);
  NEW.vat_amount_2 := ROUND(COALESCE(NEW.base_amount_2, 0) * 0.13, 2);
  NEW.vat_amount_3 := 0;
  NEW.vat_amount_4 := ROUND(COALESCE(NEW.base_amount_4, 0) * 0.05, 2);

  -- Calculate total amount as sum of all four (base + VAT) amounts
  NEW.total_amount :=
    (COALESCE(NEW.base_amount_1, 0) + COALESCE(NEW.vat_amount_1, 0)) +
    (COALESCE(NEW.base_amount_2, 0) + COALESCE(NEW.vat_amount_2, 0)) +
    (COALESCE(NEW.base_amount_3, 0) + COALESCE(NEW.vat_amount_3, 0)) +
    (COALESCE(NEW.base_amount_4, 0) + COALESCE(NEW.vat_amount_4, 0));

  -- Legacy aggregate fields
  NEW.base_amount :=
    COALESCE(NEW.base_amount_1, 0) +
    COALESCE(NEW.base_amount_2, 0) +
    COALESCE(NEW.base_amount_3, 0) +
    COALESCE(NEW.base_amount_4, 0);

  NEW.vat_amount :=
    COALESCE(NEW.vat_amount_1, 0) +
    COALESCE(NEW.vat_amount_2, 0) +
    COALESCE(NEW.vat_amount_3, 0) +
    COALESCE(NEW.vat_amount_4, 0);

  -- Remaining amount from existing paid_amount (managed by payment trigger)
  NEW.remaining_amount := COALESCE(NEW.total_amount, 0) - COALESCE(NEW.paid_amount, 0);

  -- Recalculate status from paid_amount vs total_amount. This keeps status
  -- in sync when totals change due to an invoice edit; it matches what the
  -- payments trigger would compute when paid_amount changes.
  IF COALESCE(NEW.paid_amount, 0) <= 0 THEN
    NEW.status := 'UNPAID';
  ELSIF COALESCE(NEW.paid_amount, 0) >= COALESCE(NEW.total_amount, 0) THEN
    NEW.status := 'PAID';
  ELSE
    NEW.status := 'PARTIALLY_PAID';
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: fix any invoices whose status doesn't match their current totals.
UPDATE accounting_invoices
SET status = CASE
  WHEN COALESCE(paid_amount, 0) <= 0 THEN 'UNPAID'
  WHEN COALESCE(paid_amount, 0) >= COALESCE(total_amount, 0) THEN 'PAID'
  ELSE 'PARTIALLY_PAID'
END,
updated_at = now()
WHERE status IS DISTINCT FROM (
  CASE
    WHEN COALESCE(paid_amount, 0) <= 0 THEN 'UNPAID'
    WHEN COALESCE(paid_amount, 0) >= COALESCE(total_amount, 0) THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END
);
