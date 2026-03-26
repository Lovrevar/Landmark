import { Clock, TrendingUp, CheckCircle, Pause, AlertTriangle } from 'lucide-react'
import { differenceInDays, parseISO, isPast } from 'date-fns'
import type { Milestone } from './types'

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
