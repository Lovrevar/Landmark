# Module: UI

**Path:** `src/components/Ui/`

## Overview
Shared primitive component library. Always check here before building new UI — do not duplicate these.

## Components

| Component | Purpose |
|---|---|
| `Button.tsx` | Primary, secondary, destructive button variants |
| `Input.tsx` | Text input with label and error state |
| `Textarea.tsx` | Multi-line text input |
| `Select.tsx` | Dropdown select input |
| `FormField.tsx` | Label + input + error wrapper |
| `Modal.tsx` | Base modal with backdrop and close handling |
| `ConfirmDialog.tsx` | Yes/No confirmation modal |
| `Card.tsx` | Content card container |
| `Table.tsx` | Sortable data table |
| `Pagination.tsx` | Page navigation for tables |
| `Tabs.tsx` | Tab navigation |
| `Badge.tsx` | Status/label badge |
| `Alert.tsx` | Info, warning, error alert banners |
| `StatCard.tsx` | Single KPI metric card |
| `StatGrid.tsx` | Grid layout for multiple StatCards |
| `FilterBar.tsx` | Filter controls row for tables |
| `SearchInput.tsx` | Debounced search input |
| `PageHeader.tsx` | Page title + action button header |
| `EmptyState.tsx` | Empty list / no results placeholder |
| `LoadingSpinner.tsx` | Loading indicator |

## Notes
- All components are exported from `index.ts` — import from `@/components/Ui` not individual files
- These are unstyled or minimally styled primitives — domain-specific styling belongs in the feature component
