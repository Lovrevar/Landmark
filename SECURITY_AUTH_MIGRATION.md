# Sigurnosna Migracija - Supabase Auth + RLS

## Šta je Urađeno

Vaša aplikacija je **uspješno migricirana** sa custom authentication sistema na **Supabase Authentication** sa potpunom **Row Level Security (RLS)** zaštitom.

---

## Ključne Promjene

### 1. **Database Migracija**
✅ Dodana `auth_user_id` kolona u `users` tabelu koja povezuje public.users sa auth.users
✅ Dodana `email` kolona u `users` tabelu
✅ Uklonjena `password` kolona (sigurnost - passwordi su sada hashirani od Supabase-a)
✅ Kreiran trigger koji automatski kreira `public.users` zapis kada se kreira `auth.users` zapis
✅ RLS omogućen na SVIM tabelama (21 tabela)
✅ RLS politike ažurirane da rade sa Supabase Auth (`auth.uid()`)

### 2. **AuthContext Potpuno Promijenjen**
✅ Koristi `supabase.auth.signInWithPassword()` umjesto custom login-a
✅ Koristi `supabase.auth.onAuthStateChange()` za praćenje sessiona
✅ Automatic session refresh sa JWT tokenima
✅ Uklonjen localStorage auth (zamjenjen sa Supabase session)
✅ Auto-kreiranje Admin korisnika pri prvom loginu sa `admin/admin` credentials

### 3. **Sigurnost**
✅ RLS aktivan na svim tabelama
✅ JWT tokeni zamjenjuju localStorage
✅ Password hashing automatski od Supabase-a
✅ Session management automatski
✅ Authenticated access kontrolisan kroz RLS politike

---

## Kako Se Prijaviti

### **Prvi Login (Kreiranje Admin Korisnika)**

Kada prvi put pokrenete aplikaciju:

1. Idite na login stranicu
2. Unesite credentials:
   - **Username:** `admin`
   - **Password:** `admin`
3. Pritisnite "Sign In"

**ŠTA SE DEŠAVA:**
- Sistem će pokušati da vas prijavi
- Ako korisnik ne postoji, automatski će kreirati Supabase Auth korisnika
- Trigger će automatski kreirati zapis u `public.users` tabeli
- Role će biti postavljen na `Director`
- Bit ćete automatski prijavljeni

### **Sljedeći Loginovi**

Koristite iste credentials:
- **Username:** `admin`
- **Password:** `admin`

Format email-a koji sistem interno koristi: `admin@landmark.local`

---

## RLS Politike - Kako Rade

### **Autentifikacija**
Sve RLS politike zahtijevaju da korisnik bude prijavljen kroz Supabase Auth. To znači:
- Morate biti prijavljeni da biste pristupili podacima
- JWT token se automatski šalje sa svakim API requestom
- Supabase provjerava `auth.uid()` u svakoj RLS politici

### **Politike po Tabelama**

**Opšte Tabele** (projects, customers, apartments, itd.):
```sql
-- Read: Svi authenticated korisnici
-- Insert/Update/Delete: Svi authenticated korisnici
```

**Users Tabela:**
```sql
-- Read: Authenticated korisnici (vide sve users)
-- Update: Samo svoj zapis
-- Insert: Samo Director role
```

**Work Logs Tabela:**
```sql
-- Read: Svi authenticated korisnici
-- Insert/Update/Delete: Samo Supervision i Director role
```

**Subcontractor Comments:**
```sql
-- Read: Svi authenticated korisnici
-- Insert: Svi authenticated korisnici
-- Update/Delete: Samo vlastiti komentari
```

---

## Dodavanje Novih Korisnika

Da biste dodali nove korisnike, možete:

### **Opcija 1: Kroz Supabase Dashboard**
1. Idite na Supabase Dashboard → Authentication → Users
2. Kliknite "Add user"
3. Unesite:
   - Email: `username@landmark.local` (npr. `john@landmark.local`)
   - Password: Bilo šta želite
   - User Metadata: `{"username": "john"}`
4. Trigger će automatski kreirati zapis u `public.users`
5. Možete ručno ažurirati role u `public.users` tabeli

### **Opcija 2: Programatski (Preporučeno za Buduće Proširenje)**

Možete dodati "Register" funkcionalnost u aplikaciji koja koristi:
```typescript
const { data, error } = await supabase.auth.signUp({
  email: `${username}@landmark.local`,
  password: password,
  options: {
    data: { username: username }
  }
})
```

Trigger će automatski kreirati `public.users` zapis sa default role `Sales`. Možete ga ažurirati.

---

## Struktura Tabela

### **auth.users** (Supabase Managed)
- `id` - UUID (primarni ključ)
- `email` - Email korisnika (format: username@landmark.local)
- `encrypted_password` - Hashirana lozinka
- `raw_user_meta_data` - JSONB sa `{"username": "..."}`
- `raw_app_meta_data` - JSONB za role info
- `created_at`, `updated_at`, itd.

### **public.users** (Vaša Tabela)
- `id` - UUID (primarni ključ)
- `auth_user_id` - UUID (FOREIGN KEY → auth.users.id)
- `username` - Text
- `email` - Text
- `role` - Text ('Director', 'Accounting', 'Sales', 'Supervision', 'Investment')
- `created_at` - Timestamp

**Veza:** `public.users.auth_user_id` → `auth.users.id`

---

## Troubleshooting

### **Problem: Ne vidim podatke nakon logina**

**Rješenje:**
1. Otvorite Browser Console (F12)
2. Provjerite da li vidite:
   ```
   Auth state changed: SIGNED_IN
   ```
3. Provjerite da li ima errora vezanih za RLS
4. Ako vidite "policy" ili "permission denied" errore, provjerite da li ste zaista prijavljeni

### **Problem: Ne mogu se prijaviti**

**Rješenje:**
1. Provjerite credentials: `admin` / `admin`
2. Otvorite Console i provjerite error poruke
3. Ako kaže "Invalid credentials", provjerite da li je migracija uspješno pokrenuta
4. Pokušajte refresh stranice

### **Problem: Podaci su prazni ali znam da postoje u bazi**

**Rješenje:**
1. Provjerite da li ste prijavljen (vidite username u UI-u)
2. Provjerite Console za RLS errore
3. Ako vidite "row-level security policy" error, znači da RLS blokira pristup
4. Provjerite da vaš korisnik postoji i u `auth.users` i u `public.users` sa `auth_user_id` vezom

### **Problem: "Auth state changed" se ne pojavljuje**

**Rješenje:**
1. Refresh aplikaciju
2. Provjerite da li je Supabase URL i ANON KEY ispravno podešen u `.env`
3. Provjerite network tab u DevTools da vidite da li se pozivaju Supabase API-evi

---

## Testiranje RLS-a

Da testirate da RLS radi:

### **Test 1: Logout i Pokušaj Pristupa**
1. Odjavite se
2. Otvorite Console
3. Pokušajte pristupiti podacima:
   ```javascript
   await supabase.from('projects').select('*')
   ```
4. **Trebalo bi da dobijete prazan rezultat** jer niste autentifikovani

### **Test 2: Login i Pristup**
1. Prijavite se
2. Pokušajte isti query
3. **Sada bi trebalo da vidite podatke**

---

## Sigurnosne Preporuke

1. **Promjenite Admin Password**
   Prvi put kada se prijavite, odmah promjenite password kroz Supabase Dashboard

2. **Ne Dijelite Service Role Key**
   Service Role Key zaobilazi RLS - NIKADA ga ne koristite na klijentskoj strani

3. **Redovno Ažurirajte Politike**
   Kako aplikacija raste, ažurirajte RLS politike da budu restriktivnije

4. **Monitoring**
   Omogućite Supabase logging da pratite neobične pristupe

5. **Password Politika**
   Razmislite o jačim passwordima za produkciju

---

## SQL Backup - Isključivanje RLS-a (SAMO ZA EMERGENCY!)

**UPOZORENJE:** Koristite SAMO ako je apsolutno potrebno i ODMAH vratite RLS nakon testiranja!

```sql
-- ISKLJUČI RLS na svim tabelama (OPASNO!)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
-- ... sve ostale tabele

-- VRATI RLS (ODMAH!)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ... sve ostale tabele
```

---

## Kontakt i Podrška

Ako imate problema:
1. Provjerite Browser Console za errore
2. Provjerite Supabase Dashboard → Logs
3. Provjerite da li su migracije uspješno pokrenute u Supabase Dashboard → Database → Migrations

---

**NAPOMENA:** Vaša aplikacija je sada SIGURNIJA nego prije. RLS štiti podatke na database nivou, a Supabase Auth koristi industrijske standarde za autentifikaciju (JWT tokeni, hashirani passwordi, automatski session refresh).

**VAŽNO:** Nakon prvog logina sa `admin/admin`, razmislite o promjeni passworda u nešto jače!
