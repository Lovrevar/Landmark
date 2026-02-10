/*
  # Dodavanje Isplata na Račun Funkcionalnosti za Kredite

  ## Opis
  Ova migracija dodaje podršku za novi tip kredita - "isplata na račun" kredite.
  Ovaj tip kredita automatski isplaćuje ceo iznos na bankovni račun firme pri kreiranju.

  ## Nove Kolone
  - `disbursed_to_account` (boolean) - Označava da li je kredit isplaćen direktno na račun firme
  - `disbursed_to_bank_account_id` (uuid) - Referenca na bankovni račun na koji je kredit isplaćen

  ## Funkcionalnost
  1. Kada se kreira kredit sa `disbursed_to_account = true`, automatski se povećava saldo računa
  2. Krediti sa ovim poljem ne mogu se koristiti kao direktan izvor plaćanja u fakturama
  3. Prikaz kredita sa ovim poljem se razlikuje u aplikaciji

  ## Sigurnost
  - Dodavanje CHECK constraint da bi osigurali da ako je `disbursed_to_account = true`, mora postojati `disbursed_to_bank_account_id`
  - Foreign key constraint prema `company_bank_accounts` tabeli
*/

-- Dodavanje novih kolona u bank_credits tabelu
ALTER TABLE bank_credits 
ADD COLUMN IF NOT EXISTS disbursed_to_account boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS disbursed_to_bank_account_id uuid REFERENCES company_bank_accounts(id) ON DELETE SET NULL;

-- Dodavanje CHECK constraint da osiguramo konzistentnost
ALTER TABLE bank_credits
ADD CONSTRAINT check_disbursed_account_consistency 
CHECK (
  (disbursed_to_account = false OR disbursed_to_account IS NULL) OR 
  (disbursed_to_account = true AND disbursed_to_bank_account_id IS NOT NULL)
);

-- Kreiranje indeksa za brže pretraživanje
CREATE INDEX IF NOT EXISTS idx_bank_credits_disbursed_to_account 
ON bank_credits(disbursed_to_account) WHERE disbursed_to_account = true;

CREATE INDEX IF NOT EXISTS idx_bank_credits_disbursed_bank_account 
ON bank_credits(disbursed_to_bank_account_id) WHERE disbursed_to_bank_account_id IS NOT NULL;

-- Komentar na kolone za dokumentaciju
COMMENT ON COLUMN bank_credits.disbursed_to_account IS 
'Označava da li je kredit isplaćen direktno na bankovni račun firme. Ako je true, ceo iznos kredita se dodaje na saldo računa.';

COMMENT ON COLUMN bank_credits.disbursed_to_bank_account_id IS 
'Referenca na company_bank_accounts tabelu. Označava na koji račun je kredit isplaćen ako je disbursed_to_account = true.';

-- Funkcija za automatsko povećanje salda računa kada se kreira kredit sa disbursed_to_account = true
CREATE OR REPLACE FUNCTION handle_disbursed_credit_balance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ako je novi kredit sa disbursed_to_account = true, povećaj saldo računa
  IF NEW.disbursed_to_account = true AND NEW.disbursed_to_bank_account_id IS NOT NULL THEN
    UPDATE company_bank_accounts
    SET current_balance = current_balance + NEW.amount
    WHERE id = NEW.disbursed_to_bank_account_id;
    
    -- Postavi used_amount na pun iznos jer je kredit "isplaćen"
    NEW.used_amount := NEW.amount;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Kreiranje trigera koji se aktivira PRE INSERT kredita
CREATE TRIGGER trigger_disbursed_credit_balance
BEFORE INSERT ON bank_credits
FOR EACH ROW
EXECUTE FUNCTION handle_disbursed_credit_balance();

-- Funkcija za rukovanje sa UPDATE operacijama (ako se promeni disbursed_to_account nakon kreiranja)
CREATE OR REPLACE FUNCTION handle_disbursed_credit_balance_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ako se promenilo disbursed_to_account sa false na true
  IF OLD.disbursed_to_account = false AND NEW.disbursed_to_account = true AND NEW.disbursed_to_bank_account_id IS NOT NULL THEN
    UPDATE company_bank_accounts
    SET current_balance = current_balance + NEW.amount
    WHERE id = NEW.disbursed_to_bank_account_id;
    
    NEW.used_amount := NEW.amount;
  END IF;
  
  -- Ako se promenilo disbursed_to_account sa true na false (reverzija)
  IF OLD.disbursed_to_account = true AND NEW.disbursed_to_account = false AND OLD.disbursed_to_bank_account_id IS NOT NULL THEN
    UPDATE company_bank_accounts
    SET current_balance = current_balance - OLD.amount
    WHERE id = OLD.disbursed_to_bank_account_id;
    
    NEW.used_amount := 0;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Kreiranje trigera koji se aktivira PRE UPDATE kredita
CREATE TRIGGER trigger_disbursed_credit_balance_update
BEFORE UPDATE ON bank_credits
FOR EACH ROW
WHEN (OLD.disbursed_to_account IS DISTINCT FROM NEW.disbursed_to_account)
EXECUTE FUNCTION handle_disbursed_credit_balance_update();