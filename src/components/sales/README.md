# Sales Module

Ovaj modul upravlja prodajnim procesima, projektima, zgradama i jedinicama (stanovi, garaže, spremišta).

## 📍 Lokacija

`/src/components/sales/` - Sales modul je dio components direktorija

## 📁 Struktura

```
components/sales/
├── components/           # React komponente
│   ├── views/           # Glavne view komponente (Projects, Buildings, Units)
│   ├── shared/          # Reusable komponente (Cards, Filters, Badges)
│   ├── modals/          # Modal dialozi za forme
│   └── SalesProjectsPage.tsx  # Glavni entry point
├── services/            # Supabase data access layer
│   ├── projects.repo.ts
│   ├── buildings.repo.ts
│   ├── units.repo.ts
│   ├── customers.repo.ts
│   └── sales.repo.ts
├── hooks/               # Custom React hookovi
│   ├── useSalesData.ts  # Data fetching i state
│   ├── useUnitFilters.ts
│   └── useSaleWorkflow.ts
├── context/             # React Context za state
│   └── ViewStateContext.tsx
├── types.ts             # TypeScript type definitions
├── icons.ts             # Icon mappings i helpers
├── utils.ts             # Utility funkcije
└── index.ts             # Public exports
```

## 🎯 Principi Arhitekture

### 1. Separation of Concerns
- **UI Components**: Samo prikaz i event handling
- **Services**: Svi Supabase pozivi
- **Hooks**: Business logika i state management
- **Context**: Global state za navigaciju

### 2. File Size Limits
- **Maksimalno 400 linija** po datoteci (enforced ESLint pravilima)
- **Maksimalno 150 linija** po funkciji
- CI check automatski validira ova pravila

### 3. Single Responsibility
Svaka datoteka ima jednu jasnu odgovornost:
- `ProgressBar.tsx` - samo progress bar
- `units.repo.ts` - samo unit CRUD operacije
- `useSaleWorkflow.ts` - samo sale workflow logika

## 🚀 Kako Dodati Nove Feature

### Dodavanje Novog View-a
1. Kreiraj `components/views/YourView.tsx`
2. Importuj potrebne shared komponente
3. Dodaj u `SalesProjectsPage.tsx`

### Dodavanje Novog Servisa
1. Kreiraj `services/your-entity.repo.ts`
2. Export async funkcije za CRUD operacije
3. Koristi u hookovima

### Dodavanje Novog Hooka
1. Kreiraj `hooks/useYourFeature.ts`
2. Koristi postojeće servise
3. Export iz `index.ts`

## 🔒 Pravila Održavanja

### ❌ ZABRANJENO:
- Direktni Supabase pozivi iz komponenti
- Fajlovi preko 400 linija
- Funkcije preko 150 linija
- Business logika u komponentama

### ✅ DOZVOLJENO:
- Komponente pozivaju hookove
- Hookovi pozivaju servise
- Servisi komuniciraju sa Supabase
- Shared komponente svugdje

## 📊 Statistika

- **Ukupno fajlova**: 30
- **Ukupno linija koda**: ~2,700
- **Prosječno linija po fajlu**: ~90
- **Najveći fajl**: SalesProjectsPage.tsx (364 linije)

## 🛠 Razvoj

### Prije Commitovanja
```bash
npm run check:sizes  # Validira file sizes
npm run lint         # Provjeri ESLint
npm run build        # Testiraj build
```

### ESLint Pravila
- `max-lines`: 400 linija
- `max-lines-per-function`: 150 linija
- `max-depth`: 4 nivoa
- `complexity`: 12

## 📝 Primjer Korištenja

```tsx
import SalesProjectsPage from './components/sales/components/SalesProjectsPage'

// U App.tsx
<Route path="/sales-projects" element={<SalesProjectsPage />} />
```

## 🔄 Refaktoring History

**Prije**: 1 monolit fajl od 1943 linije
**Poslije**: 30 modularnih fajlova sa prosječno 90 linija

Ovaj refaktoring omogućava:
- Lakše testiranje
- Bolje code review
- Paralelni razvoj
- Jednostavno održavanje
