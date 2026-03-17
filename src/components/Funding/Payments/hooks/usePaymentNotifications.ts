import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import { useToast } from '../../../../contexts/ToastContext'
import {
  fetchPaymentNotifications,
  calculateNotificationStats,
  dismissNotification,
  dismissMilestoneNotification,
  updateOverdueNotifications,
  getNotificationUrgency,
  type PaymentNotification,
  type NotificationStats,
} from '../Services/paymentNotificationService'

export function usePaymentNotifications() {
  const toast = useToast()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<PaymentNotification[]>([])
  const [stats, setStats] = useState<NotificationStats>({
    totalPending: 0, totalOverdue: 0, dueThisWeek: 0, dueThisMonth: 0,
    totalAmountDue: 0, totalOverdueAmount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'overdue' | 'week' | 'month'>('all')
  const [showDismissed, setShowDismissed] = useState(false)
  const [expandedNotification, setExpandedNotification] = useState<string | null>(null)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPaymentNotifications({})
      const filtered = showDismissed
        ? data
        : data.filter(n => n.status !== 'dismissed' && n.status !== 'completed')
      setNotifications(filtered)
      setStats(calculateNotificationStats(filtered))
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [showDismissed])

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(() => {
      updateOverdueNotifications()
      loadNotifications()
    }, 60000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  const filteredNotifications = useMemo(() => {
    switch (selectedFilter) {
      case 'overdue':
        return notifications.filter(n => n.status === 'overdue')
      case 'week':
        return notifications.filter(n => {
          const urgency = getNotificationUrgency(n)
          return urgency.daysRemaining <= 7 && urgency.daysRemaining >= 0
        })
      case 'month':
        return notifications.filter(n => {
          const urgency = getNotificationUrgency(n)
          return urgency.daysRemaining <= 30 && urgency.daysRemaining >= 0
        })
      default:
        return notifications
    }
  }, [notifications, selectedFilter])

  const handleDismiss = async (notification: PaymentNotification) => {
    try {
      if (notification.payment_source === 'bank') {
        const userId = user?.id
        if (!userId) return
        await dismissNotification(notification.id, userId)
      } else {
        await dismissMilestoneNotification(notification.milestone_id!)
      }
      await loadNotifications()
    } catch (err) {
      console.error('Error dismissing notification:', err)
      toast.error('Failed to dismiss notification')
    }
  }

  return {
    loading,
    stats,
    filteredNotifications,
    totalNotifications: notifications.length,
    selectedFilter,
    setSelectedFilter,
    showDismissed,
    setShowDismissed,
    expandedNotification,
    setExpandedNotification,
    handleDismiss,
  }
}
