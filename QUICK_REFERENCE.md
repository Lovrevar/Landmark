# Quick Reference - Optimized Architecture

## Import Cheat Sheet

### Hooks
```typescript
import { useProjects } from '../hooks/useProjects'
import { useApartments } from '../hooks/useApartments'
import { useSales } from '../hooks/useSales'
import { useCustomers } from '../hooks/useCustomers'
import { useSubcontractors } from '../hooks/useSubcontractors'
import { useBanks } from '../hooks/useBanks'
import { useInvestors } from '../hooks/useInvestors'
import { useFormState } from '../hooks/useFormState'
import { useModal } from '../hooks/useModal'
```

### UI Components
```typescript
import { Modal } from '../components/common/Modal'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { StatusBadge } from '../components/common/StatusBadge'
import { FormInput } from '../components/common/FormInput'
import { FormSelect } from '../components/common/FormSelect'
import { FormTextarea } from '../components/common/FormTextarea'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
```

### Services
```typescript
import { getApartmentsWithSales, bulkUpdateApartmentPrices } from '../services/apartmentService'
import { getProjectsWithApartments, getProjectsWithPhases } from '../services/projectService'
```

### Utils
```typescript
import { formatCurrency, formatPercentage, formatDate } from '../utils/formatting'
```

## Common Patterns

### Fetch Data
```typescript
const { data, loading, error, refetch } = useProjects()
```

### Create Record
```typescript
const { createProject } = useProjects()
await createProject({ name: 'New Project', ... })
```

### Update Record
```typescript
const { updateProject } = useProjects()
await updateProject(id, { name: 'Updated Name' })
```

### Delete Record
```typescript
const { deleteProject } = useProjects()
await deleteProject(id)
```

### Modal
```typescript
const modal = useModal()
<Button onClick={modal.open}>Open</Button>
<Modal isOpen={modal.isOpen} onClose={modal.close}>...</Modal>
```

### Form
```typescript
const { formData, updateField, resetForm } = useFormState({ name: '', email: '' })
<FormInput value={formData.name} onChange={(v) => updateField('name', v)} />
```

## File Structure

```
src/
├── hooks/              # Custom React hooks for data and state
├── services/           # Business logic and data transformations
├── utils/              # Helper functions
├── components/
│   ├── common/         # Reusable UI components
│   ├── sales/          # Sales feature modules
│   └── [feature]/      # Other feature-specific components
└── lib/                # Third-party integrations (Supabase)
```
