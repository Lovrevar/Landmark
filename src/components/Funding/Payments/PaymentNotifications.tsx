import React from 'react'
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle,
  Calendar,
  DollarSign,
  Filter,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format, isToday, isTomorrow } from 'date-fns'
import { LoadingSpinner, Badge, Button, EmptyState } from '../../ui'
import { getNotificationUrgency, type PaymentNotification } from './services/paymentNotificationService'
import { usePaymentNotifications } from './hooks/usePaymentNotifications'

interface PaymentNotificationsProps {
  onPaymentClick?: (notification: PaymentNotification) => void
}

const PaymentNotifications: React.FC<PaymentNotificationsProps> = ({ onPaymentClick }) => {
  const { t } = useTranslation()
  const {
    loading,
    stats,
    filteredNotifications,
    totalNotifications,
    selectedFilter,
    setSelectedFilter,
    showDismissed,
    setShowDismissed,
    expandedNotification,
    setExpandedNotification,
    handleDismiss,
  } = usePaymentNotifications()

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
        return t('funding.payments.notifications.type_first_payment')
      case 'final_payment':
        return t('funding.payments.notifications.type_final_payment')
      case 'milestone':
        return t('funding.payments.notifications.type_milestone')
      default:
        return t('funding.payments.notifications.type_payment')
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" message={t('funding.payments.notifications.loading')} />
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('funding.payments.notifications.title')}</h2>
            <p className="text-gray-600 mt-1">{t('funding.payments.notifications.description')}</p>
          </div>
          <Button
            variant="ghost"
            icon={showDismissed ? Eye : EyeOff}
            onClick={() => setShowDismissed(!showDismissed)}
          >
            {showDismissed ? t('funding.payments.notifications.hide_dismissed') : t('funding.payments.notifications.show_dismissed')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-red-700">{t('funding.payments.notifications.overdue_label')}</h3>
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-900">{stats.totalOverdue}</p>
            <p className="text-xs text-red-600 mt-1">€{stats.totalOverdueAmount.toLocaleString('hr-HR')}</p>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-orange-700">{t('funding.payments.notifications.this_week_label')}</h3>
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-900">{stats.dueThisWeek}</p>
            <p className="text-xs text-orange-600 mt-1">{t('funding.payments.notifications.due_7_days')}</p>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-yellow-700">{t('funding.payments.notifications.this_month_label')}</h3>
              <Calendar className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-900">{stats.dueThisMonth}</p>
            <p className="text-xs text-yellow-600 mt-1">{t('funding.payments.notifications.due_30_days')}</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-blue-700">{t('funding.payments.notifications.total_pending_label')}</h3>
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-900">{stats.totalPending}</p>
            <p className="text-xs text-blue-600 mt-1">{t('funding.payments.notifications.active_notifications')}</p>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-green-700">{t('funding.payments.notifications.total_due_label')}</h3>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-900">€{stats.totalAmountDue.toLocaleString('hr-HR')}</p>
            <p className="text-xs text-green-600 mt-1">{t('funding.payments.notifications.all_pending')}</p>
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
            {t('funding.payments.notifications.filter_all')} ({totalNotifications})
          </button>
          <button
            onClick={() => setSelectedFilter('overdue')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              selectedFilter === 'overdue'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('funding.payments.notifications.filter_overdue')} ({stats.totalOverdue})
          </button>
          <button
            onClick={() => setSelectedFilter('week')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              selectedFilter === 'week'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('funding.payments.notifications.filter_week')} ({stats.dueThisWeek})
          </button>
          <button
            onClick={() => setSelectedFilter('month')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              selectedFilter === 'month'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('funding.payments.notifications.filter_month')} ({stats.dueThisMonth})
          </button>
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title={t('funding.payments.notifications.all_clear_title')}
          description={t('funding.payments.notifications.all_clear_description')}
        />
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
                            <Badge variant={
                              notification.credit_type === 'construction_loan' ? 'blue' :
                              notification.credit_type === 'term_loan' ? 'green' :
                              'orange'
                            } size="sm">
                              {notification.credit_type?.replace('_', ' ').toUpperCase()}
                            </Badge>
                          ) : (
                            <Badge variant="orange" size="sm">{t('funding.payments.notifications.subcontractor_badge')}</Badge>
                          )}
                          <Badge variant="gray" size="sm">
                            {getNotificationTypeLabel(notification.notification_type)}
                            {notification.payment_source === 'bank' && ` #${notification.payment_number}`}
                            {notification.payment_source === 'subcontractor' && ` (${notification.milestone_percentage}%)`}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-2">
                          <div>
                            <p className="text-xs text-gray-600">{t('funding.payments.notifications.due_date_label')}</p>
                            <p className={`text-sm font-semibold ${getUrgencyTextColor(urgency.level)}`}>
                              {format(new Date(notification.due_date), 'MMM dd, yyyy')}
                              {isToday(new Date(notification.due_date)) && ` ${t('funding.payments.notifications.today_suffix')}`}
                              {isTomorrow(new Date(notification.due_date)) && ` ${t('funding.payments.notifications.tomorrow_suffix')}`}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600">{t('funding.payments.notifications.amount_due_label')}</p>
                            <p className="text-sm font-bold text-gray-900">
                              €{Number(notification.amount).toLocaleString('hr-HR')}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600">{t('funding.payments.notifications.urgency_label')}</p>
                            <p className={`text-sm font-semibold ${getUrgencyTextColor(urgency.level)}`}>
                              {urgency.message}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600">{t('funding.payments.notifications.project_label')}</p>
                            <p className="text-sm font-medium text-gray-900">
                              {notification.project_name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 mt-3">
                          <Button
                            variant="success"
                            size="sm"
                            icon={DollarSign}
                            onClick={() => onPaymentClick?.(notification)}
                          >
                            {t('funding.payments.notifications.record_payment_button')}
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setExpandedNotification(isExpanded ? null : notification.id)}
                          >
                            {isExpanded ? t('funding.payments.notifications.hide_details_button') : t('funding.payments.notifications.view_details_button')}
                          </Button>

                          {notification.status !== 'dismissed' && notification.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDismiss(notification)}
                            >
                              {notification.payment_source === 'subcontractor' ? t('funding.payments.notifications.mark_complete_button') : t('funding.payments.notifications.dismiss_button')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4">
                      <Badge variant={
                        notification.status === 'overdue' ? 'red' :
                        notification.status === 'pending' ? 'blue' :
                        notification.status === 'completed' ? 'green' : 'gray'
                      }>
                        {notification.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <div className="bg-white bg-opacity-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">{t('funding.payments.notifications.payment_details_heading')}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {notification.payment_source === 'bank' ? (
                            <>
                              <div>
                                <p className="text-sm text-gray-600">{t('funding.payments.notifications.bank_name_label')}</p>
                                <p className="text-sm font-medium text-gray-900">{notification.bank_name}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">{t('funding.payments.notifications.loan_type_label')}</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {notification.credit_type?.replace('_', ' ')}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">{t('funding.payments.notifications.payment_number_label')}</p>
                                <p className="text-sm font-medium text-gray-900">#{notification.payment_number}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <p className="text-sm text-gray-600">{t('funding.payments.notifications.subcontractor_label')}</p>
                                <p className="text-sm font-medium text-gray-900">{notification.subcontractor_name}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">{t('funding.payments.notifications.milestone_label')}</p>
                                <p className="text-sm font-medium text-gray-900">{notification.milestone_name}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">{t('funding.payments.notifications.milestone_percentage_label')}</p>
                                <p className="text-sm font-medium text-gray-900">{notification.milestone_percentage}%</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">{t('funding.payments.notifications.contract_value_label')}</p>
                                <p className="text-sm font-medium text-gray-900">€{notification.contract_value?.toLocaleString('hr-HR')}</p>
                              </div>
                            </>
                          )}
                          <div>
                            <p className="text-sm text-gray-600">{t('funding.payments.notifications.notification_type_label')}</p>
                            <p className="text-sm font-medium text-gray-900">
                              {getNotificationTypeLabel(notification.notification_type)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">{t('funding.payments.notifications.created_label')}</p>
                            <p className="text-sm font-medium text-gray-900">
                              {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                          {notification.dismissed_at && (
                            <div>
                              <p className="text-sm text-gray-600">{t('funding.payments.notifications.dismissed_label')}</p>
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
