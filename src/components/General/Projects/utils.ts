import { Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { daysFromToday } from '../../../utils/dateOnly'
import type { StatusVariant } from '../../../utils/statusDisplay'
import type { Milestone } from './types'
import { RESIDENTIAL_HR_TEMPLATE } from './data/milestoneTemplates'

export const NO_PHASE_KEY = '__no_phase'

const KNOWN_PHASE_ORDER: string[] = RESIDENTIAL_HR_TEMPLATE.phases.map(p => p.phaseLabel)

export interface PhaseBucket {
  key: string
  items: Milestone[]
}

export function buildPhaseBuckets(milestones: Milestone[]): PhaseBucket[] {
  const map = new Map<string, Milestone[]>()
  for (const m of milestones) {
    const key = m.phase ?? NO_PHASE_KEY
    const bucket = map.get(key)
    if (bucket) bucket.push(m)
    else map.set(key, [m])
  }
  const knownInOrder = KNOWN_PHASE_ORDER.filter(label => map.has(label))
  const unknownSorted = Array.from(map.keys())
    .filter(k => k !== NO_PHASE_KEY && !KNOWN_PHASE_ORDER.includes(k))
    .sort((a, b) => a.localeCompare(b))
  const orderedKeys = [...knownInOrder, ...unknownSorted]
  if (map.has(NO_PHASE_KEY)) orderedKeys.push(NO_PHASE_KEY)
  return orderedKeys.map(key => ({ key, items: map.get(key)! }))
}

export interface PhaseStatus {
  key: string
  total: number
  completed: number
  overdue: number
}

export function computePhaseStatuses(buckets: PhaseBucket[]): PhaseStatus[] {
  return buckets.map(b => ({
    key: b.key,
    total: b.items.length,
    completed: b.items.filter(m => m.completed).length,
    // Whole local days: a milestone due today is not yet overdue, and `isPast(parseISO(...))`
    // made it overdue from the moment the clock passed UTC midnight.
    overdue: b.items.filter(m => !m.completed && daysFromToday(m.due_date) < 0).length
  }))
}

// `getStatusConfig` lived here and returned `{ icon, label }` with the label as an English
// literal ('In Progress'), which rendered untranslated in a Croatian UI. Its only caller,
// ProjectCard, used the label and never the icon, so both are gone: the label and the badge
// colour now come from `PROJECT_STATUS` in `src/utils/statusDisplay.ts`, the one place every
// screen reads a project status from.

/**
 * A milestone's derived state: done, past its due date, or still running.
 *
 * Computed, not stored — `general_project_milestones` only has the `completed` boolean. Returns an
 * i18n key and a badge variant rather than the English literals ('Completed' / 'Overdue' /
 * 'In Progress') it used to, which both rendered raw and were string-compared by the caller to
 * pick a colour.
 */
export interface MilestoneStatusDisplay {
  icon: typeof CheckCircle
  color: string
  bg: string
  border: string
  labelKey: string
  variant: StatusVariant
  lineColor: string
}

export const getMilestoneStatus = (milestone: Milestone): MilestoneStatusDisplay => {
  if (milestone.completed) {
    return {
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-100',
      border: 'border-green-300',
      labelKey: 'status.completed',
      variant: 'green',
      lineColor: 'bg-green-300'
    }
  }

  // Overdue from the day *after* the due date, in local time — not from UTC midnight on it.
  // A milestone with no due date yields NaN, which is not < 0, so it is never overdue.
  if (daysFromToday(milestone.due_date) < 0) {
    return {
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-100',
      border: 'border-red-300',
      labelKey: 'status.overdue',
      variant: 'red',
      lineColor: 'bg-red-300'
    }
  }

  return {
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    labelKey: 'status.in_progress',
    variant: 'blue',
    lineColor: 'bg-blue-300'
  }
}
