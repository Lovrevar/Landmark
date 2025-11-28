/*
  # Fix Bank Account Balance Column Name in Trigger

  1. Problem
    - Trigger function tries to update "balance" column
    - Correct column name is "current_balance"
    - This breaks payment creation for accounting invoices

  2. Solution
    - Update trigger function to use correct column name
    - Fix logic for INCOMING vs OUTGOING invoices
    - INCOMING (kupac plaća meni) = increase current_balance
    - OUTGOING (ja plaćam dobavljaču) = decrease current_balance

  3. Changes
    - Replace all references from "balance" to "current_balance"
*/

-- Fix the function to use correct column name
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
    
    -- INCOMING = money coming IN (increase balance)
    -- Customer pays me, investor gives money, office income
    IF v_invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_INVESTMENT', 'INCOMING_OFFICE') THEN
      UPDATE company_bank_accounts
      SET current_balance = current_balance + v_amount
      WHERE id = v_account_id;
    
    -- OUTGOING = money going OUT (decrease balance)
    -- I pay supplier, sales expenses, office expenses
    ELSIF v_invoice_type IN ('OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'OUTGOING_OFFICE') THEN
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
    IF v_invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_INVESTMENT', 'INCOMING_OFFICE') THEN
      UPDATE company_bank_accounts
      SET current_balance = current_balance - v_amount
      WHERE id = v_account_id;
    
    ELSIF v_invoice_type IN ('OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'OUTGOING_OFFICE') THEN
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
