# Module: UI

**Path:** `src/components/Ui/`

## Overview

Shared primitive component library. Always check here before building new UI — do not duplicate these. All components are exported from `index.ts`.

---

## Components

### Alert.tsx
- Styled alert banner with dismiss button
- Props: `variant` ('info' | 'success' | 'warning' | 'error'), `title?`, `children`, `onDismiss?`, `className?`
- **Uses Ui:** (none — standalone primitive)

### Badge.tsx
- Compact coloured label for statuses and categories
- Props: `variant` (11 colour options), `size` ('sm' | 'md'), `children`, `className?`

### Button.tsx
- Versatile button with loading state, left/right icons, and multiple size/variant options
- Props: `variant` (11 types), `size` (6 types), `icon?`, `iconRight?`, `loading?`, `fullWidth?`, `children?`, plus all standard HTML button attributes
- Uses `forwardRef`; shows `Loader2` spinner when `loading` is true

### Card.tsx
- Compound card container with optional `Card.Header` and `Card.Body` sub-components
- Props (root): `variant` ('default' | 'bordered' | 'elevated'), `padding` ('none' | 'sm' | 'md' | 'lg'), `onClick?`, `children`, `className?`

### ConfirmDialog.tsx
- Yes/No confirmation modal with danger/primary action variants
- Props: `show`, `title`, `message` (string | ReactNode), `confirmLabel?`, `cancelLabel?`, `variant` ('danger' | 'primary'), `onConfirm`, `onCancel`, `loading?`
- Default button labels: "Potvrdi" / "Odustani" (Croatian)
- **Usage pattern (hooks):** Hook exposes `pendingDeleteId` / `confirmDelete` / `cancelDelete` / `deleting`. Component renders `<ConfirmDialog show={!!pendingDeleteId} ... onConfirm={confirmDelete} onCancel={cancelDelete} loading={deleting} />`. Delete buttons set the pending ID instead of calling confirm() directly.
- **Usage pattern (components):** Component holds `const [pendingDelete, setPendingDelete] = useState<T | null>(null)` locally. Delete button calls `setPendingDelete(item)`. ConfirmDialog rendered at bottom of JSX.
- **Never use `window.confirm()` or `confirm()`** — all deletion confirmations must use ConfirmDialog.

### EmptyState.tsx
- Centered empty list / no-results placeholder with icon and optional action
- Props: `icon?` (LucideIcon), `title`, `description?`, `action?` (ReactNode), `className?`

### FilterBar.tsx
- Responsive filter controls row (column on mobile, row on desktop)
- Props: `children`, `className?`

### Form.tsx
- Form wrapper that prevents double-submission by tracking async submit state via context
- Props: extends all HTML form attributes; `onSubmit?` accepts both sync and async handlers
- Exposes `FormSubmittingContext` (value: `boolean`) — accessible via `useFormSubmitting()` hook — so child components (e.g. submit buttons) can read the submitting state without prop drilling
- Blocks re-submission while a previous async `onSubmit` promise is pending

### FormField.tsx
- Wraps any form input with label, required marker, helper text, and error display
- Props: `label`, `required?`, `helperText?` (ReactNode), `error?`, `compact?`, `children`, `className?`

### Input.tsx
- Styled text input with focus ring
- Props: extends all HTML input attributes; `compact?`, `value?` (string | number | null)
- Uses `forwardRef`

### LoadingSpinner.tsx
- Animated loading indicator, centred or inline
- Props: `size?` ('sm' | 'md' | 'lg'), `message?`, `className?`, `inline?`

### Modal.tsx
- Full-featured modal dialog with portal rendering and body scroll lock
- Compound component: `Modal.Header`, `Modal.Body`, `Modal.Footer`
- Props (root): `show`, `onClose`, `size?` ('sm' | 'md' | 'lg' | 'xl' | 'full'), `children`
- Props (Header): `title`, `subtitle?`, `onClose`
- Props (Body): `children`, `noPadding?`, `className?`
- Props (Footer): `children`, `sticky?`
- Renders via `ReactDOM.createPortal`

### PageHeader.tsx
- Page title bar with optional description, subtitle, icon, and action slot
- Props: `title`, `description?`, `subtitle?`, `icon?`, `actions?` (ReactNode), `className?`

### Pagination.tsx
- Previous/next pagination controls with page info in Croatian
- Props: `currentPage`, `totalCount`, `pageSize`, `onPageChange`, `itemLabel?` (default: 'stavki'), `className?`
- Returns `null` when there is only one page

### SearchInput.tsx
- Search input with integrated clear (×) button
- Props: extends all HTML input attributes (minus `type`), `onClear?`, `placeholder?` (default: 'Pretraži...')
- Uses `forwardRef`

### Select.tsx
- Styled select dropdown
- Props: extends all HTML select attributes; `compact?`, `children`
- Uses `forwardRef`

### StatCard.tsx
- Single KPI metric card with icon, optional trend indicator, and colour scheme
- Props: `label?`, `title?`, `value` (string | number), `subtitle?`, `trend?`, `icon?` (LucideIcon), `color?` (8 colour schemes), `size?` ('sm' | 'md' | 'lg'), `className?`

### StatGrid.tsx
- Responsive grid layout for multiple StatCards
- Props: `columns?` (2–6), `children`, `className?`
- Automatically collapses to fewer columns on small screens

### Table.tsx
- Semantic data table with sticky headers and row hover effects
- Compound component: `Table.Head`, `Table.Body`, `Table.Th`, `Table.Td`, `Table.Tr`
- All cells support standard HTML attributes plus sticky/sortable/hoverable options

### Tabs.tsx
- Generic tab navigation with optional icon and count badge per tab
- Props: `tabs` (array of `{id, label, icon?, count?}`), `activeTab`, `onChange`, `className?`
- Generic over the tab ID type `T extends string`

### Textarea.tsx
- Styled multi-line text input with focus ring
- Props: extends all HTML textarea attributes; `compact?`, `rows?` (default: 3)
- Uses `forwardRef`

### Toast (system)
- Slide-in / slide-out toast notifications rendered in the bottom-right corner via a React portal
- **Do not import the visual component directly** — use the hook only
- `useToast()` — returns `{ toast, success, error, warning, dismiss }`; must be called inside `ToastProvider` (already mounted in `App.tsx`)
- Each toast auto-dismisses after ~4.5 s; clicking it dismisses immediately
- Variants: `'info'` (blue) | `'success'` (green) | `'warning'` (yellow) | `'error'` (red)
- Import: `import { useToast } from 'src/contexts/ToastContext'`
- Usage: replace `alert('...')` with `toast.error('...')` / `toast.success('...')` etc.

---

## Notes
- All components are exported as named exports from `index.ts` — import from `src/components/Ui` (or alias), not from individual files
- Default UI language is Croatian — default labels (e.g. "Pretraži...", "Potvrdi", "stavki") are already set; override via props where needed
- These are unstyled or minimally styled primitives — domain-specific styling belongs in the feature component
