import { daysFromToday } from './dateOnly'

/**
 * One rule for "where is this project against its end date".
 *
 * Three screens answered it three different ways and all three could lie:
 * - `General/Projects/utils.ts` said green **"Completed"** for any project past its end date,
 *   whatever its status — a stalled project read as finished — and said red "Overdue" the day
 *   *before* the end date, because `differenceInDays` truncates towards zero.
 * - `SiteManagement/ProjectsGrid.tsx` kept showing "N dana kašnjenja" on a project whose status
 *   was already `Completed`.
 * - `ProjectDetailsEnhanced.tsx` rendered the negative number itself: "-45 dana", in a calm
 *   blue tile.
 *
 * The state is decided here and the label is chosen by the caller, because the two screens word
 * it differently ("Završeno" on a card, a timeline tile in a dashboard strip) while agreeing on
 * what is true.
 */

export type ProjectTimelineState =
  /** The project's own `status` says it is finished. Dates are then not a judgement. */
  | 'completed'
  /** Past the end date and not marked completed. */
  | 'overdue'
  /** The end date is today. */
  | 'due_today'
  /** Inside `DUE_SOON_DAYS` of the end date. */
  | 'due_soon'
  | 'on_track'
  /** No usable end date — an open-ended project, not an on-track one. */
  | 'no_end_date'

export interface ProjectTimelineInfo {
  state: ProjectTimelineState
  /**
   * Whole calendar days to the end date: positive in the future, 0 today, negative past.
   * `null` when there is no usable end date, or when the project is completed (the count is
   * then not what the reader is being told).
   */
  days: number | null
}

/** Inside this many days of the end date a project reads as "due soon". */
export const DUE_SOON_DAYS = 30

/** Status values that mean the work is finished, as stored in `projects.status`. */
const COMPLETED_STATUS = 'Completed'

export function projectTimeline(
  status: string | null | undefined,
  endDate: string | null | undefined
): ProjectTimelineInfo {
  if (status === COMPLETED_STATUS) return { state: 'completed', days: null }

  const days = daysFromToday(endDate)
  if (Number.isNaN(days)) return { state: 'no_end_date', days: null }

  if (days < 0) return { state: 'overdue', days }
  if (days === 0) return { state: 'due_today', days }
  if (days < DUE_SOON_DAYS) return { state: 'due_soon', days }
  return { state: 'on_track', days }
}

/**
 * Text colour per state, with a dark pair on every one.
 *
 * Shared so a Completed project is not green on one screen and orange on another.
 */
export const PROJECT_TIMELINE_TONE: Record<ProjectTimelineState, string> = {
  completed: 'text-green-600 dark:text-green-400',
  overdue: 'text-red-600 dark:text-red-400',
  due_today: 'text-orange-600 dark:text-orange-400',
  due_soon: 'text-orange-600 dark:text-orange-400',
  on_track: 'text-green-600 dark:text-green-400',
  no_end_date: 'text-gray-600 dark:text-gray-400',
}
