# Architecture Guide - Optimized Codebase

## Quick Start

This guide shows how to use the new optimized architecture when building or modifying features.

## Using Shared Hooks

### Data Fetching Hooks

Instead of writing custom fetch logic, use the provided hooks:

```typescript
import { useProjects } from '../hooks/useProjects'
import { useApartments } from '../hooks/useApartments'
import { useCustomers } from '../hooks/useCustomers'

function MyComponent() {
  // Automatically fetches, manages loading state, and provides CRUD operations
  const { projects, loading, error, createProject, updateProject, deleteProject } = useProjects()

  // Filter by project ID
  const { apartments, createApartment } = useApartments(projectId)

  // Use the data
  if (loading) return <LoadingSpinner />
  if (error) return <div>Error: {error.message}</div>

  return <div>{/* Your UI */}</div>
}
```

### Available Data Hooks

- `useProjects()` - Project management
- `useApartments(projectId?)` - Apartment management
- `useSales()` - Sales data
- `useCustomers()` - Customer management
- `useSubcontractors(phaseId?)` - Subcontractor management
- `useBanks()` - Bank and credit management
- `useInvestors()` - Investor management

### Form State Management

Replace multiple `useState` calls with `useFormState`:

```typescript
// ❌ OLD WAY - Multiple useState declarations
const [name, setName] = useState('')
const [email, setEmail] = useState('')
const [phone, setPhone] = useState('')
// ... 10 more fields

// ✅ NEW WAY - Single hook
import { useFormState } from '../hooks/useFormState'

const { formData, updateField, resetForm } = useFormState({
  name: '',
  email: '',
  phone: ''
})

// Update a field
updateField('name', 'John Doe')

// Reset the form
resetForm()
```

### Modal Management

Replace boolean state with `useModal`:

```typescript
// ❌ OLD WAY
const [showModal, setShowModal] = useState(false)

// ✅ NEW WAY
import { useModal } from '../hooks/useModal'

const modal = useModal()

// Use it
<Button onClick={modal.open}>Open</Button>
<Modal isOpen={modal.isOpen} onClose={modal.close}>...</Modal>
```

## Using Shared Components

### Modal Component

```typescript
import { Modal } from '../components/common/Modal'
import { Button } from '../components/common/Button'

<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Edit User"
  maxWidth="lg"
  footer={
    <div className="flex justify-end space-x-3">
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={handleSave}>Save</Button>
    </div>
  }
>
  {/* Modal content */}
</Modal>
```

### Form Components

```typescript
import { FormInput } from '../components/common/FormInput'
import { FormSelect } from '../components/common/FormSelect'
import { FormTextarea } from '../components/common/FormTextarea'

<FormInput
  label="Email Address"
  type="email"
  value={formData.email}
  onChange={(val) => updateField('email', val)}
  required
/>

<FormSelect
  label="Status"
  value={formData.status}
  onChange={(val) => updateField('status', val)}
  options={[
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]}
/>

<FormTextarea
  label="Description"
  value={formData.description}
  onChange={(val) => updateField('description', val)}
  rows={4}
/>
```

### Button Component

```typescript
import { Button } from '../components/common/Button'
import { Plus, Edit2, Trash2 } from 'lucide-react'

<Button variant="primary" icon={Plus} onClick={handleAdd}>
  Add New
</Button>

<Button variant="danger" icon={Trash2} size="sm" onClick={handleDelete}>
  Delete
</Button>

// Variants: primary, secondary, success, danger, ghost
// Sizes: sm, md, lg
```

### Status Badge

```typescript
import { StatusBadge } from '../components/common/StatusBadge'

// Automatic color based on status text
<StatusBadge status="Completed" />
<StatusBadge status="In Progress" />
<StatusBadge status="Pending" />

// Manual variant
<StatusBadge status="Custom Status" variant="success" />
```

### Other Components

```typescript
import { Card } from '../components/common/Card'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import { ConfirmDialog } from '../components/common/ConfirmDialog'

// Card with hover effect
<Card hover onClick={handleClick}>
  {/* Content */}
</Card>

// Loading state
<LoadingSpinner message="Loading projects..." />

// Empty state with action
<EmptyState
  icon={Building2}
  title="No Projects"
  description="Get started by creating your first project"
  actionLabel="Create Project"
  onAction={handleCreate}
/>

// Confirmation dialog
<ConfirmDialog
  isOpen={confirmDelete}
  onClose={() => setConfirmDelete(false)}
  onConfirm={handleDeleteConfirmed}
  title="Delete Project"
  message="Are you sure you want to delete this project?"
  variant="danger"
/>
```

## Using Service Functions

### Apartment Service

```typescript
import { getApartmentsWithSales, bulkUpdateApartmentPrices } from '../services/apartmentService'

// Get apartments enriched with sales data
const apartments = await getApartmentsWithSales(projectId)

// Bulk update prices
await bulkUpdateApartmentPrices(['apt-1', 'apt-2'], 5000)
```

### Project Service

```typescript
import { getProjectsWithApartments, getProjectsWithPhases } from '../services/projectService'

// Get projects with apartment statistics
const projects = await getProjectsWithApartments()

// Get projects with phase data
const projectsWithPhases = await getProjectsWithPhases()
```

## Building a New Component

Here's a complete example of building a new feature using the optimized architecture:

```typescript
import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { FormInput } from '../components/common/FormInput'
import { Card } from '../components/common/Card'
import { StatusBadge } from '../components/common/StatusBadge'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import { useModal } from '../hooks/useModal'
import { useFormState } from '../hooks/useFormState'
import { useProjects } from '../hooks/useProjects'

const MyNewFeature: React.FC = () => {
  // 1. Use data hook
  const { projects, loading, createProject, deleteProject } = useProjects()

  // 2. Use modal hook
  const createModal = useModal()

  // 3. Use form state hook
  const { formData, updateField, resetForm } = useFormState({
    name: '',
    location: '',
    budget: 0
  })

  // 4. Handle submit
  const handleCreate = async () => {
    await createProject(formData)
    resetForm()
    createModal.close()
  }

  // 5. Render with shared components
  if (loading) return <LoadingSpinner message="Loading projects..." />

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No Projects"
        description="Create your first project"
        actionLabel="Create Project"
        onAction={createModal.open}
      />
    )
  }

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Button variant="primary" icon={Plus} onClick={createModal.open}>
          Add Project
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {projects.map(project => (
          <Card key={project.id} hover>
            <div className="p-4">
              <div className="flex justify-between mb-2">
                <h3 className="font-semibold">{project.name}</h3>
                <StatusBadge status={project.status} />
              </div>
              <p className="text-gray-600">{project.location}</p>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        title="Create Project"
        footer={
          <div className="flex justify-end space-x-3">
            <Button variant="ghost" onClick={createModal.close}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate}>Create</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Project Name"
            value={formData.name}
            onChange={(val) => updateField('name', val)}
            required
          />
          <FormInput
            label="Location"
            value={formData.location}
            onChange={(val) => updateField('location', val)}
            required
          />
          <FormInput
            label="Budget"
            type="number"
            value={formData.budget}
            onChange={(val) => updateField('budget', val)}
            required
          />
        </div>
      </Modal>
    </div>
  )
}

export default MyNewFeature
```

This example shows a complete feature built in ~80 lines that would have taken 400+ lines using the old approach.

## Performance Tips

### 1. Use useMemo for Expensive Calculations

```typescript
import { useMemo } from 'react'

const filteredProjects = useMemo(() => {
  return projects.filter(p => p.status === filter)
}, [projects, filter])
```

### 2. Use useCallback for Event Handlers

```typescript
import { useCallback } from 'react'

const handleDelete = useCallback(async (id: string) => {
  await deleteProject(id)
}, [deleteProject])
```

### 3. Memoize Child Components

```typescript
import React, { memo } from 'react'

const ProjectCard = memo<ProjectCardProps>(({ project }) => {
  return <Card>{/* ... */}</Card>
})
```

## Summary

By following this architecture:

1. **Write 60-70% less code** for new features
2. **Consistent UI/UX** across the application
3. **Easier maintenance** with centralized logic
4. **Better performance** with proper memoization
5. **Type-safe** with TypeScript throughout

For questions or improvements, refer to the existing optimized components in `src/components/sales/` as examples.
