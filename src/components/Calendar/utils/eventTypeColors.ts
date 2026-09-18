import type { EventType } from '../../../types/tasks'

// Every event-type colour in the calendar, in one place.
//
// There used to be nine hand-copied maps (month grid, day/week timeline, agenda, filter bar,
// both sidebar widgets, and three modals) and they had drifted: a reminder was amber in the
// month grid and yellow in the day view. One hue per type, used by every slot:
//   meeting blue · personal gray · deadline red · reminder amber
// Reminder is amber, not yellow, to match the task palette (taskColor.ts), whose "yellow" is
// amber too.
//
// Red is the deadline's. A task pill on the calendar therefore shows lateness with an icon,
// never a red left border — see TaskPill.tsx.
//
// Classes are written out in full: Tailwind emits only class names it finds literally in the
// source, so `bg-${hue}-500` assembled at runtime would never be generated.

export interface EventTypeStyle {
  /** Left accent on a bar or card. Pair with `border-l-[3px]`. */
  border: string
  /** Solid swatch: the filter-chip and sidebar dots, and the timeline card's 3px bar. */
  dot: string
  /** Tinted background + text for a bar or card sitting on the grid (month bar, timeline card). */
  surface: string
  /** Full border colour for a card that also uses `surface` (the day list modal). */
  outline: string
  /** The type label: the event detail header and the type picker in the event form. */
  badge: string
}

/** Every event type, in the order the filter bar and the event form list them. */
export const EVENT_TYPES = ['meeting', 'personal', 'deadline', 'reminder'] as const satisfies readonly EventType[]

export const EVENT_TYPE_COLORS: Record<EventType, EventTypeStyle> = {
  meeting: {
    border: 'border-l-blue-500',
    dot: 'bg-blue-500',
    surface: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    outline: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  personal: {
    border: 'border-l-gray-400',
    dot: 'bg-gray-400',
    surface: 'bg-gray-100 text-gray-800 dark:bg-gray-700/60 dark:text-gray-200',
    outline: 'border-gray-200 dark:border-gray-700',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
  deadline: {
    border: 'border-l-red-500',
    dot: 'bg-red-500',
    surface: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    outline: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  reminder: {
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    surface: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    outline: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
}
