/*
  # Fix retail budget calculation to use base amount (without VAT)

  1. Changes
    - Update trigger function to calculate budget_realized using base_amount instead of total_amount
    - This ensures retail contracts show payments without VAT, matching subcontractor behavior
    - Formula: (total_paid / total_amount) * base_amount for each invoice
  
  2. Security
    - No RLS changes needed
*/

-- Drop and recreate the function to calculate retail contract budget from payments
CREATE OR REPLACE FUNCTION update_retail_contract_budget_realized_from_payments()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retail_contract_id UUID;
  v_total_paid_base NUMERIC := 0;
  v_invoice RECORD;
BEGIN
  -- Get retail_contract_id from the invoice
  IF TG_OP = 'DELETE' THEN
    SELECT retail_contract_id INTO v_retail_contract_id
    FROM accounting_invoices
    WHERE id = OLD.invoice_id;
  ELSE
    SELECT retail_contract_id INTO v_retail_contract_id
    FROM accounting_invoices
    WHERE id = NEW.invoice_id;
  END IF;

  -- Only proceed if invoice has a retail_contract_id
  IF v_retail_contract_id IS NOT NULL THEN
    -- Calculate total paid (base amount without VAT) for this retail contract
    -- For each invoice, calculate: (total_paid / total_amount) * base_amount
    FOR v_invoice IN
      SELECT 
        ai.id,
        ai.base_amount,
        ai.total_amount,
        COALESCE(SUM(ap.amount), 0) as total_paid
      FROM accounting_invoices ai
      LEFT JOIN accounting_payments ap ON ap.invoice_id = ai.id
      WHERE ai.retail_contract_id = v_retail_contract_id
      GROUP BY ai.id, ai.base_amount, ai.total_amount
    LOOP
      -- Calculate proportional base amount paid
      IF v_invoice.total_amount > 0 THEN
        v_total_paid_base := v_total_paid_base + 
          ((v_invoice.total_paid / v_invoice.total_amount) * v_invoice.base_amount);
      END IF;
    END LOOP;

    -- Update the retail contract's budget_realized with base amounts only
    UPDATE retail_contracts
    SET budget_realized = v_total_paid_base,
        updated_at = now()
    WHERE id = v_retail_contract_id;
  END IF;

  -- Return appropriate row based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update the delete trigger function to use base amounts
CREATE OR REPLACE FUNCTION update_retail_contract_budget_on_invoice_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid_base NUMERIC := 0;
  v_invoice RECORD;
BEGIN
  -- Only proceed if deleted invoice had a retail_contract_id
  IF OLD.retail_contract_id IS NOT NULL THEN
    -- Recalculate total paid (base amount) for this retail contract
    -- Exclude the invoice being deleted
    FOR v_invoice IN
      SELECT 
        ai.id,
        ai.base_amount,
        ai.total_amount,
        COALESCE(SUM(ap.amount), 0) as total_paid
      FROM accounting_invoices ai
      LEFT JOIN accounting_payments ap ON ap.invoice_id = ai.id
      WHERE ai.retail_contract_id = OLD.retail_contract_id
        AND ai.id != OLD.id  -- Exclude the invoice being deleted
      GROUP BY ai.id, ai.base_amount, ai.total_amount
    LOOP
      -- Calculate proportional base amount paid
      IF v_invoice.total_amount > 0 THEN
        v_total_paid_base := v_total_paid_base + 
          ((v_invoice.total_paid / v_invoice.total_amount) * v_invoice.base_amount);
      END IF;
    END LOOP;

    UPDATE retail_contracts
    SET budget_realized = v_total_paid_base,
        updated_at = now()
    WHERE id = OLD.retail_contract_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recalculate budget_realized for all existing retail contracts using base amounts
DO $$
DECLARE
  v_contract RECORD;
  v_invoice RECORD;
  v_total_paid_base NUMERIC;
BEGIN
  FOR v_contract IN
    SELECT id FROM retail_contracts
  LOOP
    v_total_paid_base := 0;
    
    FOR v_invoice IN
      SELECT 
        ai.id,
        ai.base_amount,
        ai.total_amount,
        COALESCE(SUM(ap.amount), 0) as total_paid
      FROM accounting_invoices ai
      LEFT JOIN accounting_payments ap ON ap.invoice_id = ai.id
      WHERE ai.retail_contract_id = v_contract.id
      GROUP BY ai.id, ai.base_amount, ai.total_amount
    LOOP
      IF v_invoice.total_amount > 0 THEN
        v_total_paid_base := v_total_paid_base + 
          ((v_invoice.total_paid / v_invoice.total_amount) * v_invoice.base_amount);
      END IF;
    END LOOP;

    UPDATE retail_contracts
    SET budget_realized = v_total_paid_base,
        updated_at = now()
    WHERE id = v_contract.id;
  END LOOP;
END $$;
