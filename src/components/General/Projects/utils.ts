import { Clock, TrendingUp, CheckCircle, Pause, AlertTriangle } from 'lucide-react'
import { daysFromToday } from '../../../utils/dateOnly'
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

export const getStatusConfig = (status: string) => {
  const configs = {
    'Planning': { icon: Clock, label: 'Planning' },
    'In Progress': { icon: TrendingUp, label: 'In Progress' },
    'Completed': { icon: CheckCircle, label: 'Completed' },
    'On Hold': { icon: Pause, label: 'On Hold' }
  }
  return configs[status as keyof typeof configs] || configs['Planning']
}

export const getMilestoneStatus = (milestone: Milestone) => {
  if (milestone.completed) {
    return {
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-100',
      border: 'border-green-300',
      label: 'Completed',
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
      label: 'Overdue',
      lineColor: 'bg-red-300'
    }
  }

  return {
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    label: 'In Progress',
    lineColor: 'bg-blue-300'
  }
}
