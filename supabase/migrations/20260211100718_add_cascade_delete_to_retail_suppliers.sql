/*
  # Dodavanje CASCADE DELETE za Retail Suppliers

  ## Problem
  Kada korisnik pokuša obrisati retail supplier-a iz Accounting → Dobavljači,
  dobija error jer postoje retail_contracts koji referenciraju tog supplier-a.
  
  Trenutni constraint: ON DELETE RESTRICT
  
  ## Rješenje
  Promjena constraint-a na ON DELETE CASCADE tako da se prilikom brisanja supplier-a
  automatski obrišu i svi njegovi ugovori (retail_contracts).

  ## Promjene
  1. DROP postojećeg foreign key constraint-a retail_contracts_supplier_id_fkey
  2. Dodaj novi constraint sa ON DELETE CASCADE

  ## Napomena
  Ovo će omogućiti korisniku da obriše dobavljača zajedno sa svim njegovim ugovorima.
  Svi retail_contract_milestones će takođe biti obrisani automatski jer već imaju
  CASCADE DELETE na retail_contracts.
*/

-- Ukloni postojeći constraint
ALTER TABLE retail_contracts 
DROP CONSTRAINT IF EXISTS retail_contracts_supplier_id_fkey;

-- Dodaj novi constraint sa CASCADE DELETE
ALTER TABLE retail_contracts
ADD CONSTRAINT retail_contracts_supplier_id_fkey 
FOREIGN KEY (supplier_id) 
REFERENCES retail_suppliers(id) 
ON DELETE CASCADE;