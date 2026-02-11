/*
  # Popravljanje Stanja Računa Prilikom Brisanja Kredita

  ## Problem
  Kada se obriše kredit koji je isplaćen na račun (disbursed_to_account = true),
  stanje bankovnog računa se ne ažurira - ostaje povećano za iznos kredita.

  ## Rješenje
  Dodavanje DELETE trigger-a koji će automatski umanjiti stanje računa
  kada se obriše kredit sa disbursed_to_account = true.

  ## Funkcionalnost
  1. Pri brisanju kredita, provjeri da li je disbursed_to_account = true
  2. Ako jeste, umanji current_balance računa za amount kredita
  3. Obezbijedi da se operacija izvrši prije brisanja (BEFORE DELETE)
*/

-- Funkcija za rukovanje brisanjem kredita koji je isplaćen na račun
CREATE OR REPLACE FUNCTION handle_disbursed_credit_balance_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ako se briše kredit koji je bio isplaćen na račun, umanji stanje računa
  IF OLD.disbursed_to_account = true AND OLD.disbursed_to_bank_account_id IS NOT NULL THEN
    UPDATE company_bank_accounts
    SET current_balance = current_balance - OLD.amount
    WHERE id = OLD.disbursed_to_bank_account_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Kreiranje trigger-a koji se aktivira PRE DELETE kredita
CREATE TRIGGER trigger_disbursed_credit_balance_delete
BEFORE DELETE ON bank_credits
FOR EACH ROW
EXECUTE FUNCTION handle_disbursed_credit_balance_delete();