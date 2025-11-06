import React, { useState, useEffect } from 'react'
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle,
  X,
  Calendar,
  DollarSign,
  Building2,
  Filter,
  Eye,
  EyeOff,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import { format, isToday, isTomorrow } from 'date-fns'
import { supabase } from '../../../lib/supabase'
import {
  fetchPaymentNotifications,
  calculateNotificationStats,
  dismissNotification,
  updateOverdueNotifications,
  getNotificationUrgency,
  PaymentNotification,
  NotificationStats
} from '../services/paymentNotificationService'

interface PaymentNotificationsProps {
  onPaymentClick?: (notification: PaymentNotification) => void
}

const PaymentNotifications: React.FC<PaymentNotificationsProps> = ({ onPaymentClick }) => {
  const [notifications, setNotifications] = useState<PaymentNotification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<PaymentNotification[]>([])
  const [stats, setStats] = useState<NotificationStats>({
    totalPending: 0,
    totalOverdue: 0,
    dueThisWeek: 0,
    dueThisMonth: 0,
    totalAmountDue: 0,
    totalOverdueAmount: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'overdue' | 'week' | 'month'>('all')
  const [showDismissed, setShowDismissed] = useState(false)
  const [expandedNotification, setExpandedNotification] = useState<string | null>(null)

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(() => {
      updateOverdueNotifications()
      loadNotifications()
    }, 60000)

    return () => clearInterval(interval)
  }, [showDismissed])

  useEffect(() => {
    applyFilter()
  }, [notifications, selectedFilter])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const data = await fetchPaymentNotifications({
        status: showDismissed ? undefined : undefined
      })

      const filtered = showDismissed
        ? data
        : data.filter(n => n.status !== 'dismissed' && n.status !== 'completed')

      setNotifications(filtered)
      setStats(calculateNotificationStats(filtered))
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilter = () => {
    let filtered = [...notifications]

    switch (selectedFilter) {
      case 'overdue':
        filtered = filtered.filter(n => n.status === 'overdue')
        break
      case 'week':
        filtered = filtered.filter(n => {
          const urgency = getNotificationUrgency(n)
          return urgency.daysRemaining <= 7 && urgency.daysRemaining >= 0
        })
        break
      case 'month':
        filtered = filtered.filter(n => {
          const urgency = getNotificationUrgency(n)
          return urgency.daysRemaining <= 30 && urgency.daysRemaining >= 0
        })
        break
      default:
        break
    }

    setFilteredNotifications(filtered)
  }

  const handleDismiss = async (notification: PaymentNotification) => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return

      if (notification.payment_source === 'bank') {
        await dismissNotification(notification.id, userId)
      } else {
        // For subcontractor milestones, we just mark them as "completed" status
        // so they don't show up in pending anymore
        const { error } = await supabase
          .from('subcontractor_milestones')
          .update({ status: 'completed' })
          .eq('id', notification.milestone_id!)

        if (error) throw error
      }

      await loadNotifications()
    } catch (error) {
      console.error('Error dismissing notification:', error)
      alert('Failed to dismiss notification')
    }
  }

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-50 border-red-200'
      case 'high':
        return 'bg-orange-50 border-orange-200'
      case 'medium':
        return 'bg-yellow-50 border-yellow-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  const getUrgencyTextColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-red-800'
      case 'high':
        return 'text-orange-800'
      case 'medium':
        return 'text-yellow-800'
      default:
        return 'text-blue-800'
    }
  }

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'high':
        return <Clock className="w-5 h-5 text-orange-600" />
      case 'medium':
        return <Calendar className="w-5 h-5 text-yellow-600" />
      default:
        return <Bell className="w-5 h-5 text-blue-600" />
    }
  }

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'first_payment':
        return 'First Payment'
      case 'final_payment':
        return 'Final Payment'
      case 'milestone':
        return 'Milestone'
      default:
        return 'Payment'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading payment notifications...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Payment Notifications</h2>
            <p className="text-gray-600 mt-1">Scheduled bank credit repayments and subcontractor milestone payments</p>
          </div>
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
          >
            {showDismissed ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
            {showDismissed ? 'Hide' : 'Show'} Dismissed
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-red-700">Overdue</h3>
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-900">{stats.totalOverdue}</p>
            <p className="text-xs text-red-600 mt-1">€{stats.totalOverdueAmount.toLocaleString()}</p>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-orange-700">This Week</h3>
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-900">{stats.dueThisWeek}</p>
            <p className="text-xs text-orange-600 mt-1">Due in 7 days</p>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-yellow-700">This Month</h3>
              <Calendar className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-900">{stats.dueThisMonth}</p>
            <p className="text-xs text-yellow-600 mt-1">Due in 30 days</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-blue-700">Total Pending</h3>
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-900">{stats.totalPending}</p>
            <p className="text-xs text-blue-600 mt-1">Active notifications</p>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-green-700">Total Due</h3>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-900">€{stats.totalAmountDue.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-1">All pending</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              selectedFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setSelectedFilter('overdue')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              selectedFilter === 'overdue'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Overdue ({stats.totalOverdue})
          </button>
          <button
            onClick={() => setSelectedFilter('week')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              selectedFilter === 'week'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Week ({stats.dueThisWeek})
          </button>
          <button
            onClick={() => setSelectedFilter('month')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              selectedFilter === 'month'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Month ({stats.dueThisMonth})
          </button>
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">All Clear!</h3>
          <p className="text-gray-600">No payment notifications match your current filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const urgency = getNotificationUrgency(notification)
            const isExpanded = expandedNotification === notification.id

            return (
              <div
                key={notification.id}
                className={`border rounded-lg transition-all duration-200 ${getUrgencyColor(urgency.level)} ${
                  isExpanded ? 'shadow-lg' : 'shadow-sm hover:shadow-md'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="mt-1">
                        {getUrgencyIcon(urgency.level)}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className={`text-lg font-semibold ${getUrgencyTextColor(urgency.level)}`}>
                            {notification.payment_source === 'bank' ? notification.bank_name : notification.subcontractor_name}
                          </h3>
                          {notification.payment_source === 'bank' ? (
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              notification.credit_type === 'construction_loan' ? 'bg-blue-100 text-blue-800' :
                              notification.credit_type === 'term_loan' ? 'bg-green-100 text-green-800' :
                              notification.credit_type === 'line_of_credit' ? 'bg-purple-100 text-purple-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {notification.credit_type?.replace('_', ' ').toUpperCase()}
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                              SUBCONTRACTOR
                            </span>
                          )}
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700">
                            {getNotificationTypeLabel(notification.notification_type)}
                            {notification.payment_source === 'bank' && ` #${notification.payment_number}`}
                            {notification.payment_source === 'subcontractor' && ` (${notification.milestone_percentage}%)`}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-2">
                          <div>
                            <p className="text-xs text-gray-600">Due Date</p>
                            <p className={`text-sm font-semibold ${getUrgencyTextColor(urgency.level)}`}>
                              {format(new Date(notification.due_date), 'MMM dd, yyyy')}
                              {isToday(new Date(notification.due_date)) && ' (Today)'}
                              {isTomorrow(new Date(notification.due_date)) && ' (Tomorrow)'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600">Amount Due</p>
                            <p className="text-sm font-bold text-gray-900">
                              €{Number(notification.amount).toLocaleString()}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600">Urgency</p>
                            <p className={`text-sm font-semibold ${getUrgencyTextColor(urgency.level)}`}>
                              {urgency.message}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600">Project</p>
                            <p className="text-sm font-medium text-gray-900">
                              {notification.project_name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 mt-3">
                          <button
                            onClick={() => {
                              if (onPaymentClick) {
                                onPaymentClick(notification)
                              }
                            }}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
                            Record Payment
                          </button>

                          <button
                            onClick={() => setExpandedNotification(isExpanded ? null : notification.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors duration-200"
                          >
                            {isExpanded ? 'Hide' : 'View'} Details
                          </button>

                          {notification.status !== 'dismissed' && notification.status !== 'completed' && (
                            <button
                              onClick={() => handleDismiss(notification)}
                              className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors duration-200"
                            >
                              {notification.payment_source === 'subcontractor' ? 'Mark Complete' : 'Dismiss'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4">
                      <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                        notification.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        notification.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                        notification.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {notification.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <div className="bg-white bg-opacity-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Payment Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {notification.payment_source === 'bank' ? (
                            <>
                              <div>
                                <p className="text-sm text-gray-600">Bank Name</p>
                                <p className="text-sm font-medium text-gray-900">{notification.bank_name}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Credit Type</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {notification.credit_type?.replace('_', ' ')}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Payment Number</p>
                                <p className="text-sm font-medium text-gray-900">#{notification.payment_number}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <p className="text-sm text-gray-600">Subcontractor</p>
                                <p className="text-sm font-medium text-gray-900">{notification.subcontractor_name}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Milestone</p>
                                <p className="text-sm font-medium text-gray-900">{notification.milestone_name}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Milestone Percentage</p>
                                <p className="text-sm font-medium text-gray-900">{notification.milestone_percentage}%</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Contract Value</p>
                                <p className="text-sm font-medium text-gray-900">€{notification.contract_value?.toLocaleString()}</p>
                              </div>
                            </>
                          )}
                          <div>
                            <p className="text-sm text-gray-600">Notification Type</p>
                            <p className="text-sm font-medium text-gray-900">
                              {getNotificationTypeLabel(notification.notification_type)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Created</p>
                            <p className="text-sm font-medium text-gray-900">
                              {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                          {notification.dismissed_at && (
                            <div>
                              <p className="text-sm text-gray-600">Dismissed</p>
                              <p className="text-sm font-medium text-gray-900">
                                {format(new Date(notification.dismissed_at), 'MMM dd, yyyy HH:mm')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PaymentNotifications
