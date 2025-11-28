/*
  # Fix Bank Balance Logic - Correct INCOMING vs OUTGOING

  1. Problem
    - Logic is reversed for INCOMING and OUTGOING invoices
    
  2. Correct Logic
    - OUTGOING invoice = My company issues invoice to another company
      → They pay ME → INCREASE current_balance (money coming in)
    
    - INCOMING invoice = Another company issues invoice to my company  
      → I pay THEM → DECREASE current_balance (money going out)
      
  3. Invoice Types
    - OUTGOING_SALES = I sell to customer → they pay me → +balance
    - OUTGOING_SUPPLIER = I invoice supplier (credit note?) → +balance
    - OUTGOING_OFFICE = Office invoices out → +balance
    
    - INCOMING_SUPPLIER = Supplier invoices me → I pay them → -balance
    - INCOMING_INVESTMENT = Investment incoming → +balance (exception)
    - INCOMING_OFFICE = Office invoices in → I pay → -balance

  4. Special Cases
    - INCOMING_INVESTMENT is money coming in, so it should increase balance
*/

CREATE OR REPLACE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account_id uuid;
  v_amount numeric;
  v_invoice_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_account_id := NEW.company_bank_account_id;
    v_amount := NEW.amount;
    
    -- Get invoice type
    SELECT invoice_type INTO v_invoice_type
    FROM accounting_invoices
    WHERE id = NEW.invoice_id;
    
    -- OUTGOING = I issue invoice → They pay me → INCREASE balance
    -- Exception: INCOMING_INVESTMENT also increases balance (money coming in)
    IF v_invoice_type IN ('OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'OUTGOING_OFFICE', 'INCOMING_INVESTMENT') THEN
      UPDATE company_bank_accounts
      SET current_balance = current_balance + v_amount
      WHERE id = v_account_id;
    
    -- INCOMING = They issue invoice to me → I pay them → DECREASE balance
    ELSIF v_invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE') THEN
      UPDATE company_bank_accounts
      SET current_balance = current_balance - v_amount
      WHERE id = v_account_id;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_account_id := OLD.company_bank_account_id;
    v_amount := OLD.amount;
    
    -- Get invoice type
    SELECT invoice_type INTO v_invoice_type
    FROM accounting_invoices
    WHERE id = OLD.invoice_id;
    
    -- Reverse the operation on delete
    IF v_invoice_type IN ('OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'OUTGOING_OFFICE', 'INCOMING_INVESTMENT') THEN
      UPDATE company_bank_accounts
      SET current_balance = current_balance - v_amount
      WHERE id = v_account_id;
    
    ELSIF v_invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE') THEN
      UPDATE company_bank_accounts
      SET current_balance = current_balance + v_amount
      WHERE id = v_account_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
