import { Clock, TrendingUp, CheckCircle, Pause, AlertTriangle } from 'lucide-react'
import { differenceInDays, parseISO, isPast } from 'date-fns'
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
    overdue: b.items.filter(m => !m.completed && m.due_date && isPast(parseISO(m.due_date))).length
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

export const getDaysInfo = (startDate: string, endDate: string | null) => {
  const start = parseISO(startDate)
  const today = new Date()

  if (endDate && parseISO(endDate) < today) {
    return { text: 'Completed', color: 'text-green-600' }
  }

  const daysElapsed = differenceInDays(today, start)
  if (endDate) {
    const daysRemaining = differenceInDays(parseISO(endDate), today)
    return {
      text: daysRemaining > 0 ? `${daysRemaining} days left` : 'Overdue',
      color: daysRemaining > 0 ? 'text-gray-600' : 'text-red-600'
    }
  }

  return { text: `${daysElapsed} days elapsed`, color: 'text-gray-600' }
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

  if (milestone.due_date) {
    const dueDate = parseISO(milestone.due_date)
    if (isPast(dueDate)) {
      return {
        icon: AlertTriangle,
        color: 'text-red-600',
        bg: 'bg-red-100',
        border: 'border-red-300',
        label: 'Overdue',
        lineColor: 'bg-red-300'
      }
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
