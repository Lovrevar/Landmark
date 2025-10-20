# BRZI START - Admin Login

## 🚀 Kako Pokrenuti Aplikaciju

### 1. Priprema (AKO MIGRACIJA NIJE VEĆ POKRENUTA)

Ako već niste pokrenuli migraciju, idite u Supabase Dashboard i pokrenite:

**SQL Editor → Nova Query → Zalijepite:**
```sql
-- Učitajte cijeli sadržaj iz:
-- supabase/migrations/20251020164200_migrate_to_supabase_auth.sql
```

### 2. Isključite Email Confirmation (VAŽNO!)

Idite u Supabase Dashboard:
- **Authentication** → **Providers** → **Email**
- **Confirm email:** ISKLJUČITE (toggle OFF)
- Save

### 3. Prvi Login

Otvorite aplikaciju i prijavite se:

```
Username: admin
Password: admin
```

**ŠTA SE DEŠAVA:**
1. Sistem pokušava login
2. Korisnik ne postoji → Automatski ga kreira
3. Trigger kreira `public.users` zapis
4. Automatski vas prijavljuje
5. **VIDITE SVE PODATKE!**

### 4. Provjerite Da Radi

Nakon logina:
- Trebate vidjeti username "admin" u gornjem desnom uglu
- Trebate vidjeti sve projekte, korisnike, apartmane, itd.
- Dashboard bi trebao biti popunjen podacima

---

## 🔍 Ako Ne Vidite Podatke

### Provjera 1: Jeste li Prijavljeni?
- Vidite li username u UI-u?
- Ako NE → Logout pa se opet prijavite

### Provjera 2: Console Errors
Otvorite Browser DevTools (F12) → Console tab

**DA LI VIDITE:**
- ✅ "Auth state changed: SIGNED_IN" → Dobro!
- ❌ "policy" ili "RLS" errori → RLS blokira pristup

**AKO VIDITE RLS ERRORE:**

Idite u Supabase Dashboard → SQL Editor i pokrenite:

```sql
-- Provjera: Da li public.users ima auth_user_id?
SELECT id, username, email, auth_user_id, role
FROM public.users;

-- AKO JE auth_user_id NULL, to je problem!
-- Pokrenite ovu query da dobijete auth.users id:
SELECT id, email FROM auth.users WHERE email = 'admin@landmark.local';

-- Onda ažurirajte:
UPDATE public.users
SET auth_user_id = 'PASTE_ID_HERE'
WHERE username = 'admin';
```

### Provjera 3: Email Confirmation

Ako ste kreirali korisnika ali ne možete se prijaviti:

```sql
-- Potvrdite email ručno
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'admin@landmark.local';
```

---

## 🛠️ Manual Admin Kreacija (Backup Plan)

Ako automatska kreacija ne radi, kreirajte ručno:

### **Korak 1:** Idite u Supabase Dashboard
- **Authentication** → **Users** → **Add user**

### **Korak 2:** Popunite formu
```
Email: admin@landmark.local
Password: admin
Auto Confirm User: ✅ YES (VAŽNO!)
User Metadata: {"username": "admin"}
```

### **Korak 3:** Provjerite Public Users
```sql
SELECT * FROM public.users WHERE email = 'admin@landmark.local';
```

### **Korak 4:** Ažurirajte Role ako je potrebno
```sql
UPDATE public.users
SET role = 'Director'
WHERE email = 'admin@landmark.local';
```

### **Korak 5:** Login
Username: `admin`
Password: `admin`

---

## 📊 Provjera Da Sve Radi

Nakon uspješnog logina, pokrenite u Console:

```javascript
// Provjera session-a
const { data: session } = await supabase.auth.getSession()
console.log('Session:', session)

// Provjera pristupa podacima
const { data: projects, error } = await supabase.from('projects').select('*')
console.log('Projects:', projects)
console.log('Error:', error)
```

**Ako vidite:**
- ✅ Session sa user objektom → Prijavljeni ste!
- ✅ Projects sa podacima → RLS radi!
- ❌ Error sa "policy" → RLS blokira pristup

---

## 🚨 Emergency - Privremeno Isključi RLS

**SAMO AKO JE HITNO I ZA TESTIRANJE!**

```sql
-- OPASNO! Privremeno isključi RLS
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE apartments DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- ... sve ostale tabele

-- Testirajte aplikaciju

-- VRATITE ODMAH!
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ... sve ostale tabele
```

---

## ✅ Sve Je OK Kada:

1. ✅ Možete se prijaviti sa `admin/admin`
2. ✅ Vidite username "admin" u UI-u
3. ✅ Dashboard prikazuje podatke (projects, apartments, itd.)
4. ✅ Možete kreirati, ažurirati, brisati podatke
5. ✅ Console nema RLS errora

---

## 📞 Help!

Ako i dalje ne radi:
1. Pošaljite screenshot Console-a (F12)
2. Pošaljite rezultat ovih querya:
```sql
SELECT id, email, email_confirmed_at FROM auth.users;
SELECT id, username, email, auth_user_id, role FROM public.users;
```

---

**NAPOMENA:** Prva prijava može trajati 2-3 sekunde jer sistem kreira korisnika. Budite strpljivi!
