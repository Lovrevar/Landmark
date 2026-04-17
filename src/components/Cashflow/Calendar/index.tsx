import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react'
import { LoadingSpinner, Button, Badge, StatCard, StatGrid } from '../../ui'
import { useCalendar } from './hooks/useCalendar'
import { handleSaveBudgets } from './services/calendarService'
import BudgetModal from './forms/BudgetModal'
import { Invoice } from './types'

const AccountingCalendar: React.FC = () => {
  const { t } = useTranslation()
  const monthNames = t('cashflow_calendar.months', { returnObjects: true }) as string[]
  const dayNames = t('cashflow_calendar.days', { returnObjects: true }) as string[]
  const {
    currentDate,
    loading,
    selectedDate,
    selectedInvoices,
    budgets,
    showBudgetModal,
    budgetYear,
    budgetFormData,
    setShowBudgetModal,
    setBudgetYear,
    setBudgetFormData,
    fetchBudgets,
    getDaysInMonth,
    getInvoicesForDate,
    getMonthStats,
    handlePreviousMonth,
    handleNextMonth,
    handleDateClick,
    handleOpenBudgetModal,
    getCurrentMonthBudget
  } = useCalendar()

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate)
  const monthStats = getMonthStats()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const onSaveBudgets = async () => {
    await handleSaveBudgets(budgetYear, budgetFormData, budgets)
    await fetchBudgets()
    setShowBudgetModal(false)
  }

  const onBudgetYearChange = (newYear: number) => {
    setBudgetYear(newYear)
    const initialData: { [key: number]: number } = {}
    for (let m = 1; m <= 12; m++) {
      const existing = budgets.find(b => b.year === newYear && b.month === m)
      initialData[m] = existing?.budget_amount || 0
    }
    setBudgetFormData(initialData)
  }

  const onBudgetChange = (month: number, value: number) => {
    setBudgetFormData({
      ...budgetFormData,
      [month]: value
    })
  }

  const getTypeLabel = (invoice: Invoice) => {
    switch(invoice.invoice_type) {
      case 'INCOMING_SUPPLIER': return t('cashflow_calendar.invoice_types.incoming_supplier')
      case 'INCOMING_INVESTMENT': return t('cashflow_calendar.invoice_types.incoming_investment')
      case 'INCOMING_OFFICE': return t('cashflow_calendar.invoice_types.incoming_office')
      case 'OUTGOING_SUPPLIER': return t('cashflow_calendar.invoice_types.outgoing_supplier')
      case 'OUTGOING_SALES': return t('cashflow_calendar.invoice_types.outgoing_sales')
      case 'OUTGOING_OFFICE': return t('cashflow_calendar.invoice_types.outgoing_office')
      default: return invoice.invoice_type
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      <StatGrid columns={2}>
        <StatCard label={t('cashflow_calendar.stats.total')} value={monthStats.total} icon={CalendarIcon} color="blue" size="sm" />
        <StatCard label={t('cashflow_calendar.stats.paid')} value={monthStats.paid} icon={CheckCircle} color="green" size="sm" />
        <StatCard label={t('cashflow_calendar.stats.unpaid')} value={monthStats.unpaid} icon={Clock} color="yellow" size="sm" />
        <StatCard label={t('cashflow_calendar.stats.overdue')} value={monthStats.overdue} icon={AlertCircle} color="red" size="sm" />
      </StatGrid>

      <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{t('cashflow_calendar.summary.total_invoices')}</span>
          <span className="font-semibold text-gray-900 dark:text-white">{monthStats.total}</span>
        </div>
        <div className="border-t border-gray-300 dark:border-gray-600 my-2"></div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{t('cashflow_calendar.summary.outgoing_invoices')}</span>
          <span className="font-semibold text-green-600">€{monthStats.outgoingPaid.toLocaleString('hr-HR')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{t('cashflow_calendar.summary.incoming_paid')}</span>
          <span className="font-semibold text-red-600">€{monthStats.incomingPaid.toLocaleString('hr-HR')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{t('cashflow_calendar.summary.incoming_unpaid')}</span>
          <div className="text-right">
            <span className="font-semibold text-orange-600">€{monthStats.incomingUnpaid.toLocaleString('hr-HR')}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">{t('cashflow_calendar.summary.invoices_count', { count: monthStats.incomingUnpaidCount })}</span>
          </div>
        </div>
        <div className="border-t border-gray-300 dark:border-gray-600 my-2"></div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 dark:text-gray-200 font-medium">{t('cashflow_calendar.summary.net_label')}</span>
          <span className={`font-bold text-lg ${monthStats.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            €{monthStats.netAmount.toLocaleString('hr-HR')}
          </span>
        </div>
        {(() => {
          const budget = getCurrentMonthBudget()
          if (budget && budget.budget_amount > 0) {
            const difference = budget.budget_amount - monthStats.incomingPaid
            return (
              <>
                <div className="border-t border-gray-300 dark:border-gray-600 my-2"></div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('cashflow_calendar.summary.planned_budget')}</span>
                  <span className="font-semibold text-blue-600">€{budget.budget_amount.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{t('cashflow_calendar.summary.budget_difference')}</span>
                  <span className={`font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{Math.abs(difference).toLocaleString('hr-HR')} {difference >= 0 ? t('cashflow_calendar.summary.under_budget') : t('cashflow_calendar.summary.over_budget')}
                  </span>
                </div>
              </>
            )
          }
          return null
        })()}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {monthNames[month]} {year}
          </h3>
          <div className="flex items-center space-x-2">
            <Button variant="success" size="sm" icon={DollarSign} onClick={handleOpenBudgetModal}>
              {t('cashflow_calendar.budget_button')}
            </Button>
            <Button variant="ghost" size="icon-md" icon={ChevronLeft} onClick={handlePreviousMonth} />
            <Button variant="ghost" size="icon-md" icon={ChevronRight} onClick={handleNextMonth} />
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dayNames.map(day => (
            <div key={day} className="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-2">
              {day}
            </div>
          ))}

          {Array.from({ length: startingDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const date = new Date(year, month, day)
            date.setHours(0, 0, 0, 0)
            const dayInvoices = getInvoicesForDate(date)
            const isToday = date.getTime() === today.getTime()
            const isSelected = selectedDate?.getTime() === date.getTime()

            const hasPaid = dayInvoices.some(inv => inv.status === 'PAID')
            const hasUnpaid = dayInvoices.some(inv => inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID')
            const hasOverdue = dayInvoices.some(inv => {
              const dateParts = inv.due_date.split('T')[0].split('-')
              const dueDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]))
              dueDate.setHours(0, 0, 0, 0)
              return inv.status !== 'PAID' && dueDate < today
            })

            return (
              <button
                key={day}
                onClick={() => handleDateClick(day)}
                className={`
                  aspect-square p-1 rounded-lg border text-sm transition-all relative
                  ${isToday ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 font-bold' : 'border-gray-200 dark:border-gray-700'}
                  ${isSelected ? 'ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                  ${dayInvoices.length > 0 ? 'font-semibold' : ''}
                `}
              >
                <div className="text-gray-900 dark:text-white">{day}</div>
                {dayInvoices.length > 0 && (
                  <div className="flex justify-center space-x-0.5 mt-0.5">
                    {hasOverdue && (
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    )}
                    {hasUnpaid && !hasOverdue && (
                      <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                    )}
                    {hasPaid && (
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-center space-x-4 mt-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-gray-600 dark:text-gray-400">{t('cashflow_calendar.legend.paid')}</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-gray-600 dark:text-gray-400">{t('cashflow_calendar.legend.unpaid')}</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-gray-600 dark:text-gray-400">{t('cashflow_calendar.legend.overdue')}</span>
          </div>
        </div>
      </div>

      <BudgetModal
        showBudgetModal={showBudgetModal}
        budgetYear={budgetYear}
        budgetFormData={budgetFormData}
        budgets={budgets}
        onClose={() => setShowBudgetModal(false)}
        onSave={onSaveBudgets}
        onYearChange={onBudgetYearChange}
        onBudgetChange={onBudgetChange}
      />

      {selectedDate && selectedInvoices.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-bold text-gray-900 dark:text-white">
              {t('cashflow_calendar.table.heading', { day: selectedDate.getDate(), month: monthNames[selectedDate.getMonth()], count: selectedInvoices.length })}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('cashflow_calendar.table.invoice_number')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('cashflow_calendar.table.type')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('cashflow_calendar.table.supplier_customer')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('cashflow_calendar.table.my_company')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('cashflow_calendar.table.category')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('cashflow_calendar.table.base')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('cashflow_calendar.table.vat')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('cashflow_calendar.table.total')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('cashflow_calendar.table.paid')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('cashflow_calendar.table.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {selectedInvoices.map(invoice => {
                  const isOverdue = new Date(invoice.due_date) < today && invoice.status !== 'PAID'

                  return (
                    <tr
                      key={invoice.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        invoice.status === 'PAID'
                          ? 'bg-green-50 dark:bg-green-900/20'
                          : isOverdue
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-yellow-50 dark:bg-yellow-900/20'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">{invoice.invoice_number}</span>
                          {isOverdue && (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200">{getTypeLabel(invoice)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {invoice.bank_company?.name || invoice.office_supplier?.name || invoice.supplier?.name || invoice.customer?.name || (invoice as unknown as { retail_supplier?: { name: string } }).retail_supplier?.name || (invoice as unknown as { retail_contracts?: { retail_suppliers?: { name: string } } }).retail_contracts?.retail_suppliers?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{invoice.company?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{invoice.category || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">€{invoice.base_amount.toLocaleString('hr-HR')}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">€{invoice.vat_amount.toLocaleString('hr-HR')}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">€{invoice.total_amount.toLocaleString('hr-HR')}</td>
                      <td className={`px-4 py-3 text-right text-sm font-semibold ${
                        invoice.invoice_type.startsWith('INCOMING_')
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        €{invoice.paid_amount.toLocaleString('hr-HR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={invoice.status === 'PAID' ? 'green' : invoice.status === 'PARTIALLY_PAID' ? 'yellow' : 'red'}
                          size="sm"
                        >
                          {invoice.status === 'PAID' ? t('common.paid') : invoice.status === 'PARTIALLY_PAID' ? t('common.partial') : t('common.unpaid')}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountingCalendar
