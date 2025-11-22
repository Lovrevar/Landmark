/*
  # Kreiranje Računovodstvenog Sistema - Računi i Firme

  ## Opis
  Ova migracija kreira kompletan sistem za upravljanje računima (ulaznim i izlaznim) 
  i firmama kompanije. Stara tablica invoices se zamjenjuje novom strukturom.

  ## Nove Tablice

  ### 1. companies (Moje firme)
    - `id` (uuid, primary key)
    - `name` (text) - naziv firme
    - `tax_id` (text) - PIB
    - `vat_id` (text) - PDV broj
    - `address` (text) - adresa
    - `city` (text) - grad
    - `postal_code` (text) - poštanski broj
    - `country` (text) - država
    - `bank_account` (text) - broj računa
    - `bank_name` (text) - naziv banke
    - `contact_person` (text) - kontakt osoba
    - `contact_email` (text) - email
    - `contact_phone` (text) - telefon
    - `is_active` (boolean) - da li je firma aktivna
    - `created_at` (timestamptz)

  ### 2. accounting_invoices (Novi sistem za račune)
    - `id` (uuid, primary key)
    - `invoice_type` (text) - 'EXPENSE' ili 'INCOME'
    - `company_id` (uuid) - firma koja prima/izdaje račun
    - `supplier_id` (uuid) - dobavljač (subcontractor) za EXPENSE
    - `customer_id` (uuid) - kupac za INCOME
    - `invoice_number` (text) - broj računa
    - `issue_date` (date) - datum izdavanja
    - `due_date` (date) - datum dospijeća
    - `base_amount` (numeric) - osnovica bez PDV-a
    - `vat_rate` (numeric) - PDV stopa (0, 13, 25)
    - `vat_amount` (numeric) - iznos PDV-a (automatski izračunat)
    - `total_amount` (numeric) - ukupan iznos
    - `category` (text) - kategorija troška/prihoda
    - `project_id` (uuid) - opcionalno povezan projekt
    - `description` (text) - opis
    - `status` (text) - 'UNPAID', 'PARTIALLY_PAID', 'PAID'
    - `paid_amount` (numeric) - plaćeni iznos
    - `remaining_amount` (numeric) - preostali iznos za platiti
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    - `created_by` (uuid) - korisnik koji je kreirao

  ## Sigurnost
  - RLS je omogućen na svim tabelama
  - Director i Accounting imaju puna prava
  - Supervision može vidjeti samo račune vezane za svoje projekte
  
  ## Napomene
  - Stara tablica invoices se PREIMENOVAVA u old_invoices za sigurnost
  - PDV iznos i ukupan iznos se automatski izračunavaju kroz trigger
  - Status se automatski postavlja na 'UNPAID' pri kreiranju
*/

-- ============ STEP 1: Preimenovanje stare invoices tablice ============

ALTER TABLE IF EXISTS invoices RENAME TO old_invoices;

-- ============ STEP 2: Kreiranje companies tablice ============

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_id text,
  vat_id text,
  address text,
  city text,
  postal_code text,
  country text DEFAULT 'Hrvatska',
  bank_account text,
  bank_name text,
  contact_person text,
  contact_email text,
  contact_phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============ STEP 3: Kreiranje accounting_invoices tablice ============

CREATE TABLE IF NOT EXISTS accounting_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_type text NOT NULL CHECK (invoice_type IN ('EXPENSE', 'INCOME')),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES subcontractors(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  base_amount numeric NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
  vat_rate numeric NOT NULL DEFAULT 0 CHECK (vat_rate IN (0, 13, 25)),
  vat_amount numeric NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  category text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
  paid_amount numeric NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_amount numeric NOT NULL DEFAULT 0 CHECK (remaining_amount >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Provjere konzistentnosti
  CONSTRAINT check_supplier_or_customer CHECK (
    (invoice_type = 'EXPENSE' AND supplier_id IS NOT NULL AND customer_id IS NULL) OR
    (invoice_type = 'INCOME' AND customer_id IS NOT NULL AND supplier_id IS NULL)
  ),
  CONSTRAINT check_paid_amounts CHECK (paid_amount <= total_amount),
  CONSTRAINT check_remaining_amount CHECK (remaining_amount = total_amount - paid_amount)
);

-- Index za brže pretraživanje
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_company ON accounting_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_supplier ON accounting_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_customer ON accounting_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_project ON accounting_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_status ON accounting_invoices(status);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_type ON accounting_invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_due_date ON accounting_invoices(due_date);

-- ============ STEP 4: Trigger za automatski izračun PDV-a i total_amount ============

CREATE OR REPLACE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Izračunaj PDV iznos
  NEW.vat_amount := ROUND(NEW.base_amount * (NEW.vat_rate / 100), 2);
  
  -- Izračunaj ukupan iznos
  NEW.total_amount := NEW.base_amount + NEW.vat_amount;
  
  -- Izračunaj remaining_amount
  NEW.remaining_amount := NEW.total_amount - NEW.paid_amount;
  
  -- Postavi status na osnovu plaćanja
  IF NEW.paid_amount = 0 THEN
    NEW.status := 'UNPAID';
  ELSIF NEW.paid_amount >= NEW.total_amount THEN
    NEW.status := 'PAID';
  ELSE
    NEW.status := 'PARTIALLY_PAID';
  END IF;
  
  -- Postavi updated_at
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_invoice_amounts
  BEFORE INSERT OR UPDATE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_amounts();

-- ============ STEP 5: RLS Politike za companies ============

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Director and Accounting can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director and Accounting can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director and Accounting can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- ============ STEP 6: RLS Politike za accounting_invoices ============

ALTER TABLE accounting_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Director and Accounting can view all invoices"
  ON accounting_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Supervision can view project invoices"
  ON accounting_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN project_managers ON project_managers.user_id = users.id
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Supervision'
      AND project_managers.project_id = accounting_invoices.project_id
    )
  );

CREATE POLICY "Director and Accounting can insert invoices"
  ON accounting_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director and Accounting can update invoices"
  ON accounting_invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director can delete invoices"
  ON accounting_invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );
