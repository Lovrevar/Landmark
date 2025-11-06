import { supabase } from '../../../lib/supabase'
import { addMonths, addYears, differenceInDays, isBefore, isToday } from 'date-fns'

export interface PaymentNotification {
  id: string
  bank_credit_id?: string
  bank_id?: string
  subcontractor_id?: string
  milestone_id?: string
  due_date: string
  amount: number
  status: 'pending' | 'completed' | 'dismissed' | 'overdue'
  notification_type: 'first_payment' | 'recurring' | 'final_payment' | 'milestone'
  payment_number?: number
  dismissed_at: string | null
  dismissed_by: string | null
  created_at: string
  updated_at: string
  bank_name?: string
  credit_type?: string
  project_name?: string
  subcontractor_name?: string
  milestone_name?: string
  milestone_percentage?: number
  contract_value?: number
  payment_source: 'bank' | 'subcontractor'
}

export interface NotificationStats {
  totalPending: number
  totalOverdue: number
  dueThisWeek: number
  dueThisMonth: number
  totalAmountDue: number
  totalOverdueAmount: number
}

export const fetchPaymentNotifications = async (filters?: {
  status?: string
  bankId?: string
  daysAhead?: number
}): Promise<PaymentNotification[]> => {
  try {
    // Fetch bank payment notifications
    let bankQuery = supabase
      .from('payment_notifications')
      .select(`
        *,
        banks!payment_notifications_bank_id_fkey (name),
        bank_credits!payment_notifications_bank_credit_id_fkey (
          credit_type,
          project_id,
          projects (name)
        )
      `)
      .order('due_date', { ascending: true })

    if (filters?.status) {
      bankQuery = bankQuery.eq('status', filters.status)
    }

    if (filters?.bankId) {
      bankQuery = bankQuery.eq('bank_id', filters.bankId)
    }

    if (filters?.daysAhead) {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + filters.daysAhead)
      bankQuery = bankQuery.lte('due_date', futureDate.toISOString().split('T')[0])
    }

    const { data: bankData, error: bankError } = await bankQuery

    if (bankError) throw bankError

    const bankNotifications = (bankData || []).map(notification => ({
      ...notification,
      bank_name: notification.banks?.name || 'Unknown Bank',
      credit_type: notification.bank_credits?.credit_type || 'N/A',
      project_name: notification.bank_credits?.projects?.name || 'No Project',
      payment_source: 'bank' as const
    }))

    // Fetch subcontractor milestone notifications
    let milestoneQuery = supabase
      .from('subcontractor_milestones')
      .select(`
        *,
        subcontractors (
          name,
          contract_value
        ),
        projects (name)
      `)
      .in('status', ['pending', 'completed'])
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })

    if (filters?.daysAhead) {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + filters.daysAhead)
      milestoneQuery = milestoneQuery.lte('due_date', futureDate.toISOString().split('T')[0])
    }

    const { data: milestoneData, error: milestoneError } = await milestoneQuery

    if (milestoneError) throw milestoneError

    // Transform milestones into notifications
    const milestoneNotifications = (milestoneData || []).map(milestone => {
      const contractValue = milestone.subcontractors?.contract_value || 0
      const milestoneAmount = (contractValue * milestone.percentage) / 100
      const today = new Date()
      const dueDate = new Date(milestone.due_date)
      const isOverdue = dueDate < today && milestone.status === 'pending'

      return {
        id: milestone.id,
        milestone_id: milestone.id,
        subcontractor_id: milestone.subcontractor_id,
        due_date: milestone.due_date,
        amount: milestoneAmount,
        status: isOverdue ? 'overdue' : milestone.status === 'paid' ? 'completed' : 'pending',
        notification_type: 'milestone' as const,
        dismissed_at: null,
        dismissed_by: null,
        created_at: milestone.created_at,
        updated_at: milestone.updated_at,
        subcontractor_name: milestone.subcontractors?.name || 'Unknown Subcontractor',
        milestone_name: milestone.milestone_name,
        milestone_percentage: milestone.percentage,
        contract_value: contractValue,
        project_name: milestone.projects?.name || 'No Project',
        payment_source: 'subcontractor' as const
      } as PaymentNotification
    })

    // Filter milestone notifications by status if needed
    let filteredMilestones = milestoneNotifications
    if (filters?.status) {
      filteredMilestones = milestoneNotifications.filter(n => n.status === filters.status)
    }

    // Combine and sort by due date
    const allNotifications = [...bankNotifications, ...filteredMilestones]
    allNotifications.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

    return allNotifications
  } catch (error) {
    console.error('Error fetching payment notifications:', error)
    throw error
  }
}

export const calculateNotificationStats = (notifications: PaymentNotification[]): NotificationStats => {
  const now = new Date()
  const oneWeekFromNow = new Date()
  oneWeekFromNow.setDate(now.getDate() + 7)
  const oneMonthFromNow = new Date()
  oneMonthFromNow.setMonth(now.getMonth() + 1)

  const stats: NotificationStats = {
    totalPending: 0,
    totalOverdue: 0,
    dueThisWeek: 0,
    dueThisMonth: 0,
    totalAmountDue: 0,
    totalOverdueAmount: 0
  }

  notifications.forEach(notification => {
    const dueDate = new Date(notification.due_date)

    if (notification.status === 'pending' || notification.status === 'overdue') {
      stats.totalAmountDue += Number(notification.amount)
    }

    if (notification.status === 'pending') {
      stats.totalPending++

      if (isBefore(dueDate, oneWeekFromNow)) {
        stats.dueThisWeek++
      }

      if (isBefore(dueDate, oneMonthFromNow)) {
        stats.dueThisMonth++
      }
    }

    if (notification.status === 'overdue') {
      stats.totalOverdue++
      stats.totalOverdueAmount += Number(notification.amount)
    }
  })

  return stats
}

export const dismissNotification = async (notificationId: string, userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('payment_notifications')
      .update({
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
        dismissed_by: userId
      })
      .eq('id', notificationId)

    if (error) throw error
  } catch (error) {
    console.error('Error dismissing notification:', error)
    throw error
  }
}

export const updateOverdueNotifications = async (): Promise<void> => {
  try {
    const { error } = await supabase.rpc('update_overdue_notifications')

    if (error) throw error
  } catch (error) {
    console.error('Error updating overdue notifications:', error)
  }
}

export const getNotificationUrgency = (notification: PaymentNotification): {
  level: 'critical' | 'high' | 'medium' | 'low'
  daysRemaining: number
  message: string
} => {
  const dueDate = new Date(notification.due_date)
  const today = new Date()
  const daysRemaining = differenceInDays(dueDate, today)

  if (notification.status === 'overdue') {
    return {
      level: 'critical',
      daysRemaining,
      message: `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}`
    }
  }

  if (daysRemaining === 0) {
    return {
      level: 'critical',
      daysRemaining: 0,
      message: 'Due today'
    }
  }

  if (daysRemaining <= 7) {
    return {
      level: 'high',
      daysRemaining,
      message: `Due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
    }
  }

  if (daysRemaining <= 30) {
    return {
      level: 'medium',
      daysRemaining,
      message: `Due in ${daysRemaining} days`
    }
  }

  return {
    level: 'low',
    daysRemaining,
    message: `Due in ${daysRemaining} days`
  }
}

export const regeneratePaymentSchedule = async (creditId: string): Promise<void> => {
  try {
    const { error } = await supabase.rpc('generate_payment_schedule', { credit_id: creditId })

    if (error) throw error
  } catch (error) {
    console.error('Error regenerating payment schedule:', error)
    throw error
  }
}
