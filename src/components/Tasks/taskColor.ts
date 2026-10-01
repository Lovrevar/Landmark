// The user-chosen colour label on a task.
//
// This is deliberately NOT the deadline colour. It says whatever the crew decides it says (trade,
// floor, urgency); lateness is shown separately, and differently in the two places tasks appear:
//   - In the task list (TaskRow) the colour tints the whole card (`card`) and a thick red left
//     border is laid over it when the task is late, so a red task that is also late still shows
//     the late stripe. Nothing else on that page competes for a red stripe.
//   - On the calendar (TaskPill) the pill gets the same `card` tint, but a left border there
//     belongs to the event type (Calendar/utils/eventTypeColors.ts) and red means a deadline
//     event, so a late task shows a warning icon instead of a stripe.
// The chip is kept for the read-only drawer field, squared off (rounded-md, no clock) to stay
// apart from a deadline.
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
  {
    chipBg: string
    chipText: string
    dot: string
    swatch: string
    ring: string
    /** Background + border colour for a task tinted in this colour (TaskRow, calendar TaskPill). */
    card: string
  }
> = {
  blue: {
    chipBg: 'bg-blue-100 dark:bg-blue-900/40',
    chipText: 'text-blue-800 dark:text-blue-300',
    dot: 'bg-blue-500',
    swatch: 'bg-blue-500',
    ring: 'ring-blue-500',
    card: 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700/70',
  },
  green: {
    chipBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    chipText: 'text-emerald-800 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    swatch: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    card: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700/70',
  },
  yellow: {
    chipBg: 'bg-amber-100 dark:bg-amber-900/40',
    chipText: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
    swatch: 'bg-amber-500',
    ring: 'ring-amber-500',
    card: 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700/70',
  },
  red: {
    chipBg: 'bg-red-100 dark:bg-red-900/40',
    chipText: 'text-red-800 dark:text-red-300',
    dot: 'bg-red-500',
    swatch: 'bg-red-500',
    ring: 'ring-red-500',
    card: 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700/70',
  },
  purple: {
    chipBg: 'bg-violet-100 dark:bg-violet-900/40',
    chipText: 'text-violet-800 dark:text-violet-300',
    dot: 'bg-violet-500',
    swatch: 'bg-violet-500',
    ring: 'ring-violet-500',
    card: 'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700/70',
  },
  gray: {
    chipBg: 'bg-slate-100 dark:bg-slate-700',
    chipText: 'text-slate-700 dark:text-slate-200',
    dot: 'bg-slate-500',
    swatch: 'bg-slate-500',
    ring: 'ring-slate-500',
    card: 'bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-500/70',
  },
}

/** Guards a value read from the database, which is a plain text column. */
export function isTaskColor(value: unknown): value is TaskColor {
  return typeof value === 'string' && value in COLOR_STYLES
}
