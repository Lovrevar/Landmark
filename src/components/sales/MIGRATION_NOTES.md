# Migration Notes - Sales Module

## ✅ Uspješno Premješteno

Modul je premješten iz `/src/features/sales/` u `/src/components/sales/`

## 🔧 Izvršene Izmjene

### 1. Import Putanje - App.tsx
```tsx
// ❌ STARO
import SalesProjects from './features/sales/components/SalesProjectsPage'

// ✅ NOVO
import SalesProjects from './components/sales/components/SalesProjectsPage'
```

### 2. Interne Putanje - SalesProjectsPage.tsx
Iz `components/` foldera do roota:
```tsx
// ✅ KOREKTNO (jedan nivo gore iz components/ do sales/)
import { ViewStateProvider } from '../context/ViewStateContext'
import { useSalesData } from '../hooks/useSalesData'
import * as BuildingsRepo from '../services/buildings.repo'
import { EnhancedApartment } from '../types'
import { getUnitLabel } from '../icons'
```

### 3. Modalne Komponente - Deep Import
Iz `components/modals/` do `lib/`:
```tsx
// ✅ KOREKTNO (6 nivoa gore)
import { Customer } from '../../../../../lib/supabase'
// components/sales/components/modals/ → 4 nivoa do src/ + 2 do lib/
```

### 4. View Komponente
Iz `components/views/` koriste `../../` za root sales modula:
```tsx
import { ProjectWithBuildings } from '../../types'
import { ProgressBar } from '../shared/ProgressBar'
```

### 5. Shared Komponente
Iz `components/shared/` takođe koriste `../../`:
```tsx
import { UnitType } from '../../types'
import { getUnitIcon } from '../../icons'
```

## 🎯 Pravila za Import Putanje

### Od SalesProjectsPage.tsx:
- Context, hooks, services, types, icons → `../`

### Od Views/Shared/Modals:
- Types, icons, utils → `../../`
- Između views/shared/modals → `../`

### Do External lib/:
- Od root sales/ → `../../lib/supabase`
- Od services/hooks/ → `../../../lib/supabase`
- Od components/ → `../../../../lib/supabase`
- Od components/modals/ → `../../../../../lib/supabase`

## 📝 Kreiran Fajl

`buildings.repo.ts` je bio nedostajući i dodan u:
`/src/components/sales/services/buildings.repo.ts`

## ✅ Build Status

```bash
npm run build  # ✅ USPJEŠAN
```

## 🚨 Uobičajeni Problemi

### Problem: "Cannot resolve module"
**Rješenje**: Provjeri da li sve ovo postoji:
```bash
ls -la src/components/sales/services/buildings.repo.ts
ls -la src/components/sales/context/ViewStateContext.tsx
```

### Problem: "Expected JavaScript module"
**Rješenje**: Clear dev server i restart:
```bash
# Zatvori dev server
# Obriši cache
rm -rf node_modules/.vite
# Restart
npm run dev
```

### Problem: Stari import putanje
**Akcija**: Global search & replace:
```
Find: from './features/sales
Replace: from './components/sales
```

## 📂 Finalna Struktura

```
src/components/sales/
├── components/
│   ├── SalesProjectsPage.tsx
│   ├── views/
│   ├── shared/
│   └── modals/
├── services/
│   ├── buildings.repo.ts  ← ⚠️ Bio nedostajući
│   ├── projects.repo.ts
│   ├── units.repo.ts
│   ├── customers.repo.ts
│   └── sales.repo.ts
├── hooks/
├── context/
├── types.ts
├── icons.ts
└── utils.ts
```

---

**Datum Migracije**: October 2025
**Status**: ✅ Kompletiran i Testiran
