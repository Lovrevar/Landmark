# Architecture Guidelines

## Overview

This document defines the architectural principles and rules for maintaining a clean, modular, and maintainable codebase. These guidelines prevent regression to monolithic structures and ensure consistent code organization.

## Core Principles

### 1. Single Responsibility Principle
Each file, component, and function should have ONE clear purpose. If you can't describe what a file does in a single sentence, it's doing too much.

### 2. Modular Feature Organization
Features are organized into self-contained modules with clear boundaries. Each feature module is independent and follows the same internal structure.

### 3. Separation of Concerns
Business logic, presentation, data fetching, and type definitions must be separated into distinct layers.

## Folder Structure

### Feature Module Structure

Each feature module MUST follow this structure:

```
src/components/[FeatureName]/
├── types/           # TypeScript interfaces and type definitions
├── services/        # API calls and data transformation logic
├── hooks/           # Custom React hooks for state and data management
├── views/           # Presentational components (pure, receives props)
└── forms/           # Modal and form components
```

### Example: Current Implementation

```
src/components/Site/
├── types/
│   └── siteTypes.ts           # All Site-related TypeScript types
├── services/
│   └── siteService.ts         # API calls and data operations
├── hooks/
│   └── useSiteData.ts         # Data fetching and state management
├── views/
│   ├── ProjectsGrid.tsx       # Project list presentation
│   ├── ProjectDetail.tsx      # Project detail presentation
│   └── PhaseCard.tsx          # Phase presentation component
└── forms/
    ├── PhaseSetupModal.tsx
    ├── EditPhaseModal.tsx
    └── WirePaymentModal.tsx
```

## Layer Responsibilities

### `/types` Folder

**Purpose**: Define TypeScript interfaces, types, and enums

**Rules**:
- ONLY contains type definitions
- NO implementation code
- NO imports from services or hooks
- Export all types that are used outside the module

**Example**:
```typescript
// ✅ CORRECT
export interface Project {
  id: string
  name: string
  location: string
}

export type ProjectStatus = 'Planning' | 'In Progress' | 'Completed'

// ❌ INCORRECT - No functions or business logic
export const calculateBudget = (project: Project) => { ... }
```

### `/services` Folder

**Purpose**: Handle API calls, data transformation, and business logic

**Rules**:
- Contains functions for CRUD operations
- Handles data transformation and validation
- Interacts with Supabase or external APIs
- Returns typed data
- NO React components or JSX
- NO React hooks (useState, useEffect, etc.)

**Example**:
```typescript
// ✅ CORRECT
export const siteService = {
  async fetchProjects() {
    const { data, error } = await supabase
      .from('construction_projects')
      .select('*')
    if (error) throw error
    return data
  },

  async updateProject(id: string, updates: Partial<Project>) {
    // business logic here
  }
}

// ❌ INCORRECT - No React hooks in services
export const useFetchProjects = () => {
  const [projects, setProjects] = useState([])
  // ...
}
```

### `/hooks` Folder

**Purpose**: Custom React hooks for data fetching and state management

**Rules**:
- ONLY contains custom React hooks
- Uses services layer for data operations
- Manages React state (useState, useEffect)
- Returns data and functions for components to use
- Name MUST start with "use" (React convention)

**Example**:
```typescript
// ✅ CORRECT
export const useSiteData = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)

  const loadProjects = async () => {
    setLoading(true)
    const data = await siteService.fetchProjects()
    setProjects(data)
    setLoading(false)
  }

  return { projects, loading, loadProjects }
}

// ❌ INCORRECT - No API calls directly in hooks
export const useSiteData = () => {
  const { data } = await supabase.from('projects').select('*')
  // Use service layer instead!
}
```

### `/views` Folder

**Purpose**: Presentational components that render UI

**Rules**:
- ONLY receives data via props
- NO direct API calls or data fetching
- NO business logic (calculations should be in services or passed as props)
- Focus on presentation and user interaction
- Can contain local UI state (e.g., open/closed for dropdowns)
- Should be easily testable with mock props

**Example**:
```typescript
// ✅ CORRECT
interface ProjectsGridProps {
  projects: Project[]
  onSelectProject: (project: Project) => void
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({
  projects,
  onSelectProject
}) => {
  return (
    <div className="grid">
      {projects.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          onClick={() => onSelectProject(project)}
        />
      ))}
    </div>
  )
}

// ❌ INCORRECT - No data fetching in view components
export const ProjectsGrid = () => {
  const [projects, setProjects] = useState([])

  useEffect(() => {
    supabase.from('projects').select('*').then(...)
  }, [])

  return <div>...</div>
}
```

### `/forms` Folder

**Purpose**: Modal dialogs and form components

**Rules**:
- Contains form and modal components
- Handles form validation and submission
- Can call service functions for data submission
- Should receive onSuccess/onClose callbacks from parent
- Isolated from view components

**Example**:
```typescript
// ✅ CORRECT
interface PhaseSetupModalProps {
  projectId: string
  onClose: () => void
  onSuccess: () => void
}

export const PhaseSetupModal: React.FC<PhaseSetupModalProps> = ({
  projectId,
  onClose,
  onSuccess
}) => {
  const handleSubmit = async (formData) => {
    await siteService.createPhases(projectId, formData)
    onSuccess()
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

## Component Size Guidelines

### Maximum File Size
- **Target**: 150-250 lines per file
- **Hard Limit**: 300 lines
- **If exceeded**: Refactor into smaller components

### When to Split a Component

Split when you notice:
1. Multiple distinct responsibilities in one file
2. Scrolling extensively to find related code
3. Difficulty understanding the component at a glance
4. Repeated code blocks that could be extracted
5. Complex conditional rendering that could be separate components

### Extraction Strategy

```typescript
// ❌ TOO LARGE - One component doing too much
export const ProjectManagement = () => {
  // 400 lines of code handling:
  // - Project list
  // - Project details
  // - Phase management
  // - Subcontractor management
  // - Payment tracking
}

// ✅ CORRECT - Split into focused components
export const ProjectManagement = () => {
  return selectedProject ? (
    <ProjectDetail project={selectedProject} />
  ) : (
    <ProjectsList onSelect={setSelectedProject} />
  )
}
```

## Module Separation Rules

### Feature Modules MUST Be Self-Contained

Each feature module (Site, Sales, Investment, etc.) should:
- Contain ALL code related to that feature
- NOT directly import from other feature modules
- Share code through the top-level `/lib` or `/utils` folders

```typescript
// ❌ INCORRECT - Feature modules importing from each other
import { salesService } from '../Sales/services/salesService'

// ✅ CORRECT - Share through common utilities
import { formatCurrency } from '../../utils/formatters'
```

### When to Create a New Module

Create a new feature module when:
1. The feature has distinct business domain (e.g., Sales vs Site Management)
2. The feature has its own data models and types
3. The feature would have 3+ components
4. The feature is conceptually separate from existing modules

### Shared Code Location

```
src/
├── lib/              # Shared libraries (supabase client, etc.)
├── utils/            # Shared utility functions
├── contexts/         # Shared React contexts (Auth, Theme, etc.)
├── components/       # Feature modules
│   ├── Site/
│   ├── Sales/
│   └── Investment/
└── common/           # Shared UI components (Button, Modal, etc.)
```

## Import Organization

### Import Order

Always organize imports in this order:

```typescript
// 1. React and React-related
import React, { useState, useEffect } from 'react'

// 2. Third-party libraries
import { Building2, Users } from 'lucide-react'

// 3. Types (from current or shared types)
import { Project, Phase } from '../types/siteTypes'
import { Subcontractor } from '../../lib/supabase'

// 4. Services
import { siteService } from '../services/siteService'

// 5. Hooks
import { useSiteData } from '../hooks/useSiteData'

// 6. View components
import { ProjectsGrid } from './ProjectsGrid'
import { PhaseCard } from './PhaseCard'
```

### Import Path Rules

- Use relative imports within the same module: `../services/siteService`
- Use absolute imports for shared code: `../../lib/supabase`
- NEVER import from other feature modules directly
- Views should ONLY import types and other views, NOT services or hooks

## Anti-Patterns to Avoid

### ❌ Monolithic Components

```typescript
// DON'T: Everything in one file
export const SiteManagement = () => {
  // 1000+ lines of code
  // - Multiple state variables
  // - API calls
  // - Business logic
  // - Complex UI rendering
}
```

### ❌ Mixed Responsibilities

```typescript
// DON'T: View component with business logic
export const ProjectCard = ({ projectId }) => {
  const calculateBudget = () => {
    // Complex business logic
  }

  const fetchData = async () => {
    await supabase.from('projects').select('*')
  }

  return <div>...</div>
}
```

### ❌ Circular Dependencies

```typescript
// DON'T: Components importing each other
// File A imports File B
// File B imports File A
```

### ❌ God Objects

```typescript
// DON'T: One service file handling multiple domains
export const appService = {
  // Site management
  fetchProjects() {},
  createPhase() {},

  // Sales management
  fetchCustomers() {},
  createSale() {},

  // Investment tracking
  fetchInvestors() {},
  // ... hundreds of methods
}
```

## Code Review Checklist

Before submitting or accepting code, verify:

- [ ] Each file has a single, clear responsibility
- [ ] Component files are under 300 lines
- [ ] Types are in `/types` folder
- [ ] API calls are in `/services` folder
- [ ] React hooks are in `/hooks` folder
- [ ] View components only handle presentation
- [ ] No feature module imports from another feature module
- [ ] No business logic in view components
- [ ] Imports are organized correctly
- [ ] No circular dependencies
- [ ] Shared code is in `/lib` or `/utils`, not duplicated

## Migration Path

If you encounter monolithic code:

1. **Identify responsibilities**: List what the code does
2. **Create folder structure**: Set up types/services/hooks/views
3. **Extract types first**: Move interfaces to types folder
4. **Extract services**: Move API calls and business logic
5. **Extract hooks**: Move state management
6. **Refactor views**: Keep only presentation logic
7. **Test thoroughly**: Ensure nothing broke

## Benefits of This Architecture

1. **Maintainability**: Easy to find and modify code
2. **Testability**: Each layer can be tested independently
3. **Scalability**: New features follow the same pattern
4. **Collaboration**: Multiple developers can work without conflicts
5. **Reusability**: Services and hooks can be shared
6. **Clarity**: Clear separation of concerns
7. **Performance**: Easier to optimize specific layers

## Questions?

When in doubt:
- Is this file doing more than one thing? → Split it
- Can I describe this file's purpose in one sentence? → Good sign
- Would a new developer understand this structure? → Validation test
- Am I mixing presentation and business logic? → Separate them

---

**Remember**: The goal is not to create more files for the sake of it, but to organize code in a way that makes it easy to understand, maintain, and extend. Follow these guidelines, and your codebase will remain clean and manageable as it grows.
