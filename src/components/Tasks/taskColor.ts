// The user-chosen colour label on a task.
//
// This is deliberately NOT the deadline colour. The red left border on TaskRow says whether a
// task is late; this says whatever the crew decides it says (trade, floor, urgency). Both
// appear on the same row, so the chip is given a different shape — rounded-md and no clock —
// to keep a red chip readable next to a red deadline.
//
// The palette is closed. Tailwind generates utility classes by scanning source files for
// literal class names, so `bg-${color}-100` built at runtime is never emitted and the chip
// would render with no background. Every class below is therefore written out in full, and
// the list must stay in step with two other copies of it:
//   - tasks_color_check in supabase/migrations/20260813090000_task_color.sql
//   - src/lib/taskColor.ts in the standalone mobile task app, which shares the table
// Labels live in the locale files (tasks.colors.*) rather than here, since Cognilion ships
// English and Croatian.

export type TaskColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'

// Order here is the order of the swatches in the picker.
export const TASK_COLORS: { value: TaskColor; labelKey: string }[] = [
  { value: 'blue', labelKey: 'tasks.colors.blue' },
  { value: 'green', labelKey: 'tasks.colors.green' },
  { value: 'yellow', labelKey: 'tasks.colors.yellow' },
  { value: 'red', labelKey: 'tasks.colors.red' },
  { value: 'purple', labelKey: 'tasks.colors.purple' },
  { value: 'gray', labelKey: 'tasks.colors.gray' },
]

export const COLOR_STYLES: Record<
  TaskColor,
  { chipBg: string; chipText: string; dot: string; swatch: string; ring: string }
> = {
  blue: {
    chipBg: 'bg-blue-100 dark:bg-blue-900/40',
    chipText: 'text-blue-800 dark:text-blue-300',
    dot: 'bg-blue-500',
    swatch: 'bg-blue-500',
    ring: 'ring-blue-500',
  },
  green: {
    chipBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    chipText: 'text-emerald-800 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    swatch: 'bg-emerald-500',
    ring: 'ring-emerald-500',
  },
  yellow: {
    chipBg: 'bg-amber-100 dark:bg-amber-900/40',
    chipText: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
    swatch: 'bg-amber-500',
    ring: 'ring-amber-500',
  },
  red: {
    chipBg: 'bg-red-100 dark:bg-red-900/40',
    chipText: 'text-red-800 dark:text-red-300',
    dot: 'bg-red-500',
    swatch: 'bg-red-500',
    ring: 'ring-red-500',
  },
  purple: {
    chipBg: 'bg-violet-100 dark:bg-violet-900/40',
    chipText: 'text-violet-800 dark:text-violet-300',
    dot: 'bg-violet-500',
    swatch: 'bg-violet-500',
    ring: 'ring-violet-500',
  },
  gray: {
    chipBg: 'bg-slate-100 dark:bg-slate-700',
    chipText: 'text-slate-700 dark:text-slate-200',
    dot: 'bg-slate-500',
    swatch: 'bg-slate-500',
    ring: 'ring-slate-500',
  },
}

/** Guards a value read from the database, which is a plain text column. */
export function isTaskColor(value: unknown): value is TaskColor {
  return typeof value === 'string' && value in COLOR_STYLES
}
