# Module: UI

**Path:** `src/components/ui/`

## Overview

Shared primitive component library. Always check here before building new UI — do not duplicate these. All components are exported from `index.ts`.

---

## Components

> **Barrel-file gotcha.** `AvatarStack`, `InlineLoadError`, `MarkdownView`, `SearchableSelect`,
> `ToggleSwitch` and `Toast` are **not** re-exported from `src/components/ui/index.ts` — import
> them by path (`import SearchableSelect from '../../ui/SearchableSelect'`). `Toast` is never
> imported directly at all; use `useToast()`. Everything else is available from `'../../ui'`.

### Alert.tsx
- Styled alert banner with dismiss button
- Props: `variant` ('info' | 'success' | 'warning' | 'error'), `title?`, `children`, `onDismiss?`, `className?`
- ⚠️ An `onClose` prop is also declared but **never rendered** — use `onDismiss` for the X button
- Use it for a failure over data that is still on screen; use `ErrorState` when there is nothing to show
- **Uses Ui:** (none — standalone primitive)

### AvatarStack.tsx
- Overlapping initials avatars for a set of users, with a `+N` overflow bubble
- Props: `users` (`{id, username?}[]`), `max?` (default overflow cutoff), `size?` ('xs' | 'sm' | 'md', default 'md'), `title?`
- Used for task assignees and calendar event attendees

### Badge.tsx
- Compact coloured label for statuses and categories
- Props: `variant` (11 colour options), `size` ('sm' | 'md'), `children`, `className?`

### Button.tsx
- Versatile button with loading state, left/right icons, and multiple size/variant options
- Props: `variant` (16 types), `size` (6 types), `icon?`, `iconRight?`, `loading?`, `fullWidth?`, `children?`, plus all standard HTML button attributes
- Uses `forwardRef`; shows `Loader2` spinner when `loading` is true, and on its own while an `onClick` that returns a Promise is pending
- Shows a blue focus ring on **keyboard** focus only (`focus-visible`), offset against the page background in both themes; mouse clicks show nothing
- Subtle coloured variants for row actions: `ghost-primary` (edit/view), `ghost-success` (pay/complete), `ghost-warning`, `ghost-danger` (delete) — transparent, coloured icon/text with a dark-mode pair, tinted hover. `info` (soft blue) and `warning` (soft yellow) are the filled-soft pair
- **Don't recolour a variant through `className`.** The variant's own `dark:` classes outrank a plain colour class, so `variant="ghost" className="text-red-600"` renders grey in dark mode. Pick or add a variant instead; `className` is for layout

### Card.tsx
- Compound card container with optional `Card.Header` and `Card.Body` sub-components
- Props (root): `variant` ('default' | 'bordered' | 'elevated'), `padding` ('none' | 'sm' | 'md' | 'lg'), `onClick?`, `children`, `className?`

### ConfirmDialog.tsx
- Yes/No confirmation modal with danger/primary action variants
- Props: `show`, `title`, `message` (string | ReactNode), `confirmLabel?`, `cancelLabel?`, `variant` ('danger' | 'primary'), `onConfirm`, `onCancel`, `loading?`, `extraAction?`
- `extraAction` (`{ label, onClick, variant?, disabled? }`) adds a third button between Cancel and
  Confirm, for a question that genuinely has three answers — "save and leave" next to "leave
  without saving". Defaults to the `outline-danger` variant, and is disabled while `loading`. Do
  not reach for it to fit two unrelated actions into one dialog
- Default button labels: "Potvrdi" / "Odustani" (Croatian)
- **Usage pattern (hooks):** Hook exposes `pendingDeleteId` / `confirmDelete` / `cancelDelete` / `deleting`. Component renders `<ConfirmDialog show={!!pendingDeleteId} ... onConfirm={confirmDelete} onCancel={cancelDelete} loading={deleting} />`. Delete buttons set the pending ID instead of calling confirm() directly.
- **Usage pattern (components):** Component holds `const [pendingDelete, setPendingDelete] = useState<T | null>(null)` locally. Delete button calls `setPendingDelete(item)`. ConfirmDialog rendered at bottom of JSX.
- **Never use `window.confirm()` or `confirm()`** — all deletion confirmations must use ConfirmDialog.
- Escape runs `onCancel` via [`useEscapeKey`](#useescapekey-srchooksuseescapekeyts), and only while this dialog is the topmost open layer — it never also closes the modal, drawer or panel it was opened from
- `role="alertdialog"` for `variant="danger"` (else `dialog`), named by the title and described by the message. Focus opens on **Cancel**, the always-safe choice, so a reflexive Enter never confirms a delete; Tab stays inside and closing returns focus to the opener

### EmptyState.tsx
- Centered empty list / no-results placeholder with icon and optional action
- Props: `icon?` (LucideIcon), `title`, `description?`, `action?` (ReactNode), `className?`

### ErrorState.tsx
- Shown when data could not be **loaded**. Built on `EmptyState`, so it matches the empty look but says something different
- Props: `onRetry?` (no button without it), `title?`, `description?`, `compact?` (tighter padding for a card or modal body), `className?`
- Defaults to `common.load_error_title` / `common.load_error_description` / `common.retry`
- **The three-way rule every list page follows:**
  1. first load, nothing yet → `LoadingSpinner`
  2. load failed, nothing to show → `ErrorState` **in the content area**, with the page header, filter bar and search left mounted so filters survive and retry works in place
  3. load failed but stale rows are on screen → keep the rows, put a dismissible `Alert variant="error"` with a retry above them
  4. loaded fine, genuinely no rows → `EmptyState`
- Figures derived from a failed load (stat cards, totals, counts) must be withheld or shown as `—`, never as 0 or €0
- A page whose data failed must not offer an export of it (see Debt Status)
- Rule 2 assumes something list-sized failed. For a single **control** — a picker whose options
  did not load, a sidebar card — use `InlineLoadError` instead

### FilterBar.tsx
- Responsive filter controls row (column on mobile, row on desktop)
- Props: `children`, `className?`

### FilterChip.tsx
- Single toggleable filter pill; pairs with `FilterBar`
- Props: `active`, `onClick`, `children`, `icon?` (LucideIcon), `dotColor?`, `count?` (badge), `size?` ('sm' | 'md'), `className?`

### Form.tsx
- Form wrapper that prevents double-submission by tracking async submit state via context
- Props: extends all HTML form attributes; `onSubmit?` accepts both sync and async handlers
- Exposes `FormSubmittingContext` (value: `boolean`) — accessible via `useFormSubmitting()` hook — so child components (e.g. submit buttons) can read the submitting state without prop drilling
- Blocks re-submission while a previous async `onSubmit` promise is pending

### FormField.tsx
- Wraps any form input with label, required marker, helper text, and error display
- Props: `label`, `required?`, `helperText?` (ReactNode), `error?`, `compact?`, `group?`, `children`, `className?`
- **Links the label to its control automatically.** FormField generates an id and provides it through context; `Input`, `Select`, `Textarea` and `SearchableSelect` (and `DateInput` / `CurrencyInput`, which render `Input`) pick it up as their `id`, plus `aria-describedby` (the error, else the helper text), `aria-invalid` and `aria-required`. Clicking the label focuses the field; screen readers and Playwright's `getByLabel` find it by label. Anything passed explicitly on the control wins
- One control per FormField — two controls would share the id
- `group` — for a field that is a set of controls or a read-only value (a `SegmentedControl`, a category tree, "budget from TIC"): the label becomes the name of a `role="group"` wrapper instead of pointing at a single input
- A custom control can join in with `useFormFieldControl()` (exported from `FormField.tsx`), which returns `{ controlId, describedBy, invalid, required }` or null outside a FormField

### InlineLoadError.tsx
- One line of "this could not be loaded", small enough to sit under a form control or inside a sidebar card. Imported by path (not in the barrel)
- Props: `message?` (already-translated sentence; defaults to `common.load_error_title`), `onRetry?` (no retry link without it), `className?`
- **Why it exists:** a select whose options failed to load looks exactly like a select whose value is "none", and an empty sidebar widget looks exactly like "nothing is pending". `ErrorState` is too large for either and replaces a whole list; this replaces nothing
- **Pair it with a disabled control** wherever the displayed value would otherwise contradict the value being saved. The rule across Calendar, Tasks and Documents: when an option list fails, disable the control, keep the stored value visible (as `common.option_name_unavailable` if the list cannot name it), and never let the placeholder claim "none"
- Precedent wording for the sentence: `common.projects_load_error`, `common.users_load_error`

### Input.tsx
- Styled text input with focus ring
- Props: extends all HTML input attributes; `compact?`, `value?` (string | number | null)
- Uses `forwardRef`

### LoadingSpinner.tsx
- Animated loading indicator, centred or inline
- Props: `size?` ('sm' | 'md' | 'lg'), `message?`, `className?`, `inline?`

### MarkdownView.tsx
- Renders a Markdown string with the app's typography, via `react-markdown` + `remark-gfm` (so tables, strikethrough and task lists work)
- Props: `content`, `className?`
- Used by AI chat message bodies and task descriptions. Prefer this over hand-rolling a Markdown renderer

### Modal.tsx
- Full-featured modal dialog with portal rendering and body scroll lock
- Compound component: `Modal.Header`, `Modal.Body`, `Modal.Footer`
- Props (root): `show`, `onClose`, `size?` ('sm' | 'md' | 'lg' | 'xl' | 'full'), `ariaLabel?`, `children`
- **Dialog semantics:** the panel is `role="dialog"` + `aria-modal`, named by `Modal.Header`'s title. A modal that draws its own header instead must pass `ariaLabel`
- **Focus:** on open, focus moves to the panel (or stays on an `autoFocus` field inside it), Tab is kept inside, and on close focus returns to the element that opened it — via [`useFocusTrap`](#usefocustrap-srchooksusefocustrapts). The panel, not the first input, takes focus so a phone's keyboard doesn't pop up on open. The header close button is labelled `common.close`
- Props (Header): `title`, `subtitle?` (string | null), `onClose`, `children?` — children render
  under the title and subtitle (badges, a contact line); when present the close button pins to the
  top of the header instead of centring on it
- Props (Body): `children`, `noPadding?`, `className?`
- Props (Footer): `children`, `sticky?` (default `true`)
- Renders via `ReactDOM.createPortal`
- Closes on `Escape` keypress and on backdrop click (mouse-down + mouse-up tracked so a drag that starts inside the dialog won't dismiss it). Escape goes through [`useEscapeKey`](#useescapekey-srchooksuseescapekeyts), so a `ConfirmDialog` opened over a modal closes alone rather than taking the modal with it
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

### SearchableSelect.tsx
- Dropdown with a type-to-filter search box — for selects long enough that a plain `Select` is unusable (suppliers, projects, partners)
- Props: `value`, `options` (`SearchableOption[]` = `{value, label, sublabel?}`), `onChange`, `placeholder?`, `searchPlaceholder?`, `clearLabel?`, `allowClear?`, `disabled?`
- Exports the `SearchableOption` type

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
- **Colours:** the default cell text colour is set on `Table.Body` and inherited — `Td` sets none — so a colour class on a `Td` wins in both themes. Give it a dark pair (`text-green-600 dark:text-green-400`); a bare `-600` is low-contrast on the dark background. Row tints on `Tr` (`bg-red-50 dark:bg-red-900/20`) also survive the mobile card view: its card background and border are declared inside `:where()`, at zero specificity, precisely so a utility class on the row wins

### Tabs.tsx
- Generic tab navigation with optional icon and count badge per tab
- Props: `tabs` (array of `{id, label, icon?` (ReactNode)`, count?}`), `activeTab`, `onChange`, `className?`
- Generic over the tab ID type `T extends string`
- **Mobile-responsive:** the tab bar scrolls horizontally (no visible scrollbar) and tabs never wrap, with tighter padding on small screens

### Textarea.tsx
- Styled multi-line text input with focus ring
- Props: extends all HTML textarea attributes; `compact?`, `rows?` (default: 3)
- Uses `forwardRef`

### ToggleSwitch.tsx
- Accessible on/off switch with optional label and description
- Props: `checked`, `onChange`, `label?`, `description?`, `disabled?`, `id?` (auto-derived from `label` when omitted)
- Use this for booleans instead of a bare checkbox

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

## Layer hooks

### useEscapeKey (`src/hooks/useEscapeKey.ts`)
- `useEscapeKey(active: boolean, onEscape: () => void)` — Escape closes the **topmost** open layer and nothing under it
- Every layer that closes on Escape registers here instead of adding its own `document` keydown listener: `Modal`, `ConfirmDialog`, the task drawer (`TaskDetail`), the AI chat panel and its image lightbox, the calendar cluster popover, the chat group-members panel, the Cashflow password dialog in `Layout`, and Retail's milestone overlay. Document listeners fire in the order they were added, so with one listener per layer the parent — opened first — heard Escape first and closed over its own confirm dialog
- `active` is when the layer joins the stack: pass its open flag, or `true` for a component that only exists while open. `onEscape` may be an inline function — it is read from a ref at key time, so a re-render never reorders the stack
- An Escape that something already handled is ignored: an input that uses Escape to cancel its own edit (a title field, a rename box, the @mention list) should call `e.preventDefault()` in its React `onKeyDown`, which runs before the shared document listener
- **Don't** add a raw `document.addEventListener('keydown', …)` for Escape in a new layer — use this hook, or nested layers break again
- The stack logic is exported (`pushEscapeLayer`, `dispatchEscape`) and unit-tested in `useEscapeKey.test.ts`

### useFocusTrap (`src/hooks/useFocusTrap.ts`)
- `useFocusTrap(containerRef, active, { initialFocus? })` — keeps keyboard focus inside the **topmost** open modal layer and returns it when the layer closes
- Used by `Modal`, `ConfirmDialog`, the task drawer, the Cashflow password dialog, the AI image lightbox and Retail's milestone overlay. Traps stack like Escape layers: a ConfirmDialog over a Modal traps inside the dialog and hands focus back to the Modal on close
- On activation focus goes to `initialFocus`, else the container (give it `tabIndex={-1}`) — unless something inside already has focus, so `autoFocus` fields still win. Tab and Shift+Tab wrap within the container; focus that lands outside (a click behind the overlay) is pulled back. On deactivation focus returns to the previously focused element if it is still on the page and the user hasn't moved focus elsewhere
- **Modal layers only.** Non-modal panels and popovers (AI chat panel, chat members panel, calendar cluster popover) take Escape via `useEscapeKey` and no trap
- **A new modal overlay uses `Modal` / `ConfirmDialog`, or both hooks plus `role="dialog"`, `aria-modal` and an accessible name** — otherwise keyboard and screen-reader users get lost behind it
- Stack and wrap logic (`pushTrap`, `topTrap`, `nextTabIndex`) are unit-tested in `useFocusTrap.test.ts`; the DOM behaviour is covered by `e2e/sales/customers.spec.ts`

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
- Variants: `'info'` (blue) | `'success'` (green) | `'warning'` (amber, dark text — white on yellow was unreadable) | `'error'` (red)
- Import: `import { useToast } from 'src/contexts/ToastContext'`
- Usage: replace `alert('...')` with `toast.error('...')` / `toast.success('...')` etc.

---

### Unsaved changes (system)
- One app-wide guard for screens that edit in memory and only write on Save. `UnsavedChangesProvider`
  is mounted in `App.tsx`; the dialog it shows is a `ConfirmDialog` rendered by the provider itself
- `useUnsavedChanges(isDirty, save?)` — arms the guard while the screen holds unsaved edits.
  Re-asserted on every render rather than only when `isDirty` flips, and disarmed on unmount, so
  nothing can lag behind the screen
- Pass `save: () => Promise<boolean>` and the dialog offers **Save and leave** as its primary
  action, with "leave without saving" demoted to the third button. The handler **must** resolve
  `false` (or throw) when the save fails — the dialog then stays open with an error rather than
  navigating away from work that was never stored. Reporting *why* it failed stays the screen's job
- Without a save handler the dialog is the plain two-button question it was, with "leave without
  saving" as the danger action
- `useLeaveGuard()` — returns `requestLeave(proceed)`. Runs `proceed` straight through when nothing
  is dirty, otherwise defers it to the dialog. Use it for any action that abandons the current
  screen's edits, navigation or not — the TIC screen puts its project selector behind it
- **Every navigation in `Layout.tsx` already goes through it**: menu links (with modified clicks left
  as plain `<a>` behaviour so open-in-new-tab still works), the Chat / Tasks / Calendar buttons,
  the profile switcher and logout. A new screen only needs `useUnsavedChanges`
- Reloads, closes and links out of the app are caught by the browser's own `beforeunload` prompt,
  whose wording is not ours to set
- Only one screen is on show at a time, so the guard is a single flag rather than a registry
- Deliberately **not** react-router's `useBlocker`: that needs a data router, and the app is mounted
  on `<BrowserRouter>`
- Import: `import { useUnsavedChanges, useLeaveGuard } from 'src/contexts/UnsavedChangesContext'`

---

## Notes
- All components are exported as named exports from `index.ts` — import from `src/components/ui` (or alias), not from individual files. The `EntityList` helpers (`ListViewToggle`, `SortDropdown`) and their types (`ListViewMode`, `SortOption`) are re-exported from the top-level `index.ts` too
- The responsive/list hooks (`useMediaQuery`, `useListPreferences`) are imported from `src/hooks/`, not from this library
- Default UI language is Croatian — default labels (e.g. "Pretraži...", "Potvrdi", "stavki") are already set; override via props where needed
- These are unstyled or minimally styled primitives — domain-specific styling belongs in the feature component
