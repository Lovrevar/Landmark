# Module: UI

**Path:** `src/components/ui/`

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
- Props (Header): `title`, `subtitle?` (string | null), `onClose`, `children?`
- Props (Body): `children`, `noPadding?`, `className?`
- Props (Footer): `children`, `sticky?` (default `true`)
- Renders via `ReactDOM.createPortal`
- Closes on `Escape` keypress and on backdrop click (mouse-down + mouse-up tracked so a drag that starts inside the dialog won't dismiss it)
- **Mobile-responsive:** tighter padding and taller max-height (`max-h-[95vh]`) on small screens; the footer stacks its actions full-width and reversed on mobile, switching to a right-aligned row on `sm` and up

### PageHeader.tsx
- Page title bar with optional description and an action slot
- Props: `title`, `description?`, `subtitle?`, `icon?` (ElementType), `actions?` (ReactNode), `className?`
- **Mobile-responsive:** title block and actions stack vertically on phones and sit on one row from `sm` up; actions wrap when they overflow
- Note: `subtitle` and `icon` are accepted by the prop type but not currently rendered by the component — only `title`, `description`, and `actions` are displayed

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

### SegmentedControl.tsx
- Inline pill-style toggle group (button-based, `role="tablist"`); the active option is highlighted in blue
- Props: `value`, `options` (array of `{value, label, icon?` (LucideIcon)`}`), `onChange`, `size?` ('sm' | 'md', default 'md'), `className?`, `ariaLabel?`
- Generic over the option value type `T extends string`; exports the `SegmentedOption<T>` type
- Used as the base for `ListViewToggle` (see EntityList below)

### StatCard.tsx
- Single KPI metric card with icon, optional trend indicator, and colour scheme
- Props: `label?`, `title?`, `value` (string | number), `subtitle?`, `trend?`, `icon?` (LucideIcon), `color?` (8 colour schemes), `size?` ('sm' | 'md' | 'lg'), `className?`

### StatGrid.tsx
- Responsive grid layout for multiple StatCards
- Props: `columns?` (2–6, default 4), `children`, `className?`
- Collapses to 2 columns on phones and steps up through `sm`/`md` breakpoints to the requested `columns`; gap also tightens on small screens

### Table.tsx
- Semantic data table with sticky headers and row hover effects
- Compound component: `Table.Head`, `Table.Body`, `Table.Th`, `Table.Td`, `Table.Tr`
- Props (root): `dense?` (tighter cell padding, propagated to `Th`/`Td` via context), `fitContent?` (size to content / left-align instead of stretching to fill — avoids wide column gaps on sparse tables), `children`, `className?`
- Props (`Th`): `sortable?`, `sticky?` (pins to the right edge), plus standard HTML `th` attributes
- Props (`Td`): `sticky?`, `label?` (column label shown beside the value in the mobile card view), plus standard HTML `td` attributes
- Props (`Tr`): `hoverable?` (default `true`), plus standard HTML `tr` attributes
- **Mobile-responsive:** the root wrapper carries the `responsive-table` class which switches the table to a stacked card layout on small screens (see `index.css`); each cell's `label` (rendered as `data-label`) is used to label its value in that card view

### Tabs.tsx
- Generic tab navigation with optional icon and count badge per tab
- Props: `tabs` (array of `{id, label, icon?` (ReactNode)`, count?}`), `activeTab`, `onChange`, `className?`
- Generic over the tab ID type `T extends string`
- **Mobile-responsive:** the tab bar scrolls horizontally (no visible scrollbar) and tabs never wrap, with tighter padding on small screens

### Textarea.tsx
- Styled multi-line text input with focus ring
- Props: extends all HTML textarea attributes; `compact?`, `rows?` (default: 3)
- Uses `forwardRef`

---

## EntityList sub-library

**Path:** `src/components/ui/EntityList/`

Helpers for list/grid views: a view-mode toggle and a sort dropdown. Re-exported from the top-level `index.ts` (`ListViewToggle`, `SortDropdown`, and the `ListViewMode` / `SortOption` types).

### ListViewToggle.tsx
- Two-option toggle (cards vs. table) built on top of `SegmentedControl`; renders the `LayoutGrid` and `List` icons
- Props: `value` (`ListViewMode` = 'cards' | 'table'), `onChange`, `cardsLabel`, `tableLabel`, `size?` ('sm' | 'md', default 'md'), `ariaLabel?`
- Exports the `ListViewMode` type
- Labels are required (no defaults) so callers supply localized strings

### SortDropdown.tsx
- Native `<select>` styled as a compact sort control, with leading `ArrowUpDown` and trailing `ChevronDown` icons
- Props: `value`, `options` (array of `SortOption<T>` = `{value, label}`), `onChange`, `className?`, `ariaLabel?`
- Generic over the option value type `T extends string`; exports the `SortOption<T>` type

---

## Responsive / list hooks

These hooks live in `src/hooks/` (not `src/components/ui/`) but pair with the list/responsive UI primitives above.

### useMediaQuery (`src/hooks/useMediaQuery.ts`)
- `useMediaQuery(query: string): boolean` — subscribes to a CSS media query and re-renders on change; SSR-safe (returns `false` until mounted)
- Convenience wrappers (breakpoints mirror Tailwind defaults; "mobile" = below the `md` breakpoint):
  - `useIsMobile(): boolean` — true below 768px (`max-width: 767px`)
  - `useIsTabletUp(): boolean` — true at 768px and up
  - `useIsDesktop(): boolean` — true at 1024px and up

### useListPreferences (`src/hooks/useListPreferences.ts`)
- `useListPreferences<T extends object>(key: string, defaults: T): [T, (patch: Partial<T>) => void]`
- Persists list-view preferences (e.g. view mode, sort field) to `localStorage` under `key`, merging stored values over `defaults` on load
- Returns the current prefs object and a `patch` updater that shallow-merges a partial; reads/writes are wrapped in try/catch so a missing or corrupt `localStorage` entry falls back to `defaults`

---

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
- All components are exported as named exports from `index.ts` — import from `src/components/ui` (or alias), not from individual files. The `EntityList` helpers (`ListViewToggle`, `SortDropdown`) and their types (`ListViewMode`, `SortOption`) are re-exported from the top-level `index.ts` too
- The responsive/list hooks (`useMediaQuery`, `useListPreferences`) are imported from `src/hooks/`, not from this library
- Default UI language is Croatian — default labels (e.g. "Pretraži...", "Potvrdi", "stavki") are already set; override via props where needed
- These are unstyled or minimally styled primitives — domain-specific styling belongs in the feature component
