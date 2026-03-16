/*
  # Migracija na Supabase Authentication sa RLS

  ## Promjene

  1. Users Tabela - Priprema za Supabase Auth
    - Dodaj `auth_user_id` kolonu koja pokazuje na auth.users(id)
    - Dodaj `email` kolonu za Supabase Auth
    - Ukloni `password` kolonu (sigurnost - Supabase Auth koristi hashirane passworde)

  2. Trigger za Automatsko Kreiranje Public Users Zapisa
    - Kada se kreira novi korisnik u auth.users, automatski se kreira zapis u public.users
    - Koristi app_metadata za čuvanje role informacija

  3. RLS Politike - Korigirane za Supabase Auth
    - Sve politike sada koriste auth.uid() koji pokazuje na auth.users.id
    - Povezivanje sa public.users preko auth_user_id kolone

  4. Inicijalni Admin Korisnik
    - Automatski će biti kreiran kroz Supabase Dashboard ili SQL

  ## Sigurnost
  - RLS je omogućen na svim tabelama
  - Sve lozinke su hashirane od strane Supabase Auth
  - JWT tokeni zamjenjuju localStorage
  - Session management je automatski
*/

-- ============ STEP 1: Modifikuj users tabelu ============

-- Dodaj auth_user_id kolonu ako ne postoji
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE users ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Dodaj email kolonu ako ne postoji
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email'
  ) THEN
    ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
  END IF;
END $$;

-- Ukloni password kolonu (sigurnost - više nije potrebna)
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Kreiraj indeks za brže pretraživanje
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- ============ STEP 2: Funkcija za Automatsko Kreiranje Users Zapisa ============

-- Funkcija koja se poziva kada se kreira novi auth.users zapis
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Kreiraj public.users zapis povezan sa auth.users
  INSERT INTO public.users (auth_user_id, username, email, role, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_app_meta_data->>'role', 'Sales')::TEXT,
    NOW()
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger koji poziva funkciju nakon kreiranja auth.users zapisa
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============ STEP 3: Ažuriraj RLS Politike za Users Tabelu ============

-- Obrisi stare politike
DROP POLICY IF EXISTS "Authenticated users can read all users" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;

-- Kreiraj nove politike koje rade sa Supabase Auth
CREATE POLICY "Authenticated users can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own record"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Director can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- ============ STEP 4: Ažuriraj Ostale RLS Politike ============

-- Ažuriraj subcontractor_comments politike da koriste auth_user_id
DROP POLICY IF EXISTS "Users can update their own comments" ON subcontractor_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON subcontractor_comments;

-- Ažurirane politike za subcontractor comments
CREATE POLICY "Users can update their own comments"
  ON subcontractor_comments
  FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own comments"
  ON subcontractor_comments
  FOR DELETE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Ažuriraj work_logs politike
DROP POLICY IF EXISTS "Supervision and Director can create work logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can update work logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can delete work logs" ON work_logs;

CREATE POLICY "Supervision and Director can create work logs"
  ON work_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Supervision', 'Director')
    )
  );

CREATE POLICY "Supervision and Director can update work logs"
  ON work_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Supervision', 'Director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Supervision', 'Director')
    )
  );

CREATE POLICY "Supervision and Director can delete work logs"
  ON work_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Supervision', 'Director')
    )
  );
