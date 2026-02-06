import React from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react'
import { LoadingSpinner } from '../ui'
import { useCalendar } from './hooks/useCalendar'
import { handleSaveBudgets } from './services/calendarService'
import BudgetModal from './forms/BudgetModal'
import { Invoice } from './types/calendarTypes'

const monthNames = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'
]

const dayNames = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub']

const AccountingCalendar: React.FC = () => {
  const {
    currentDate,
    invoices,
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
      case 'INCOMING_SUPPLIER': return 'Ulazni - Dobavljač'
      case 'INCOMING_INVESTMENT': return 'Ulazni - Investicije'
      case 'INCOMING_OFFICE': return 'Ulazni - Office'
      case 'OUTGOING_SUPPLIER': return 'Izlazni - Dobavljač'
      case 'OUTGOING_SALES': return 'Izlazni - Prodaja'
      case 'OUTGOING_OFFICE': return 'Izlazni - Office'
      default: return invoice.invoice_type
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-medium">Ukupno računa</p>
              <p className="text-2xl font-bold text-blue-900">{monthStats.total}</p>
            </div>
            <CalendarIcon className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-medium">Plaćeno</p>
              <p className="text-2xl font-bold text-green-900">{monthStats.paid}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-yellow-600 font-medium">Neplaćeno</p>
              <p className="text-2xl font-bold text-yellow-900">{monthStats.unpaid}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-600 font-medium">Overdue</p>
              <p className="text-2xl font-bold text-red-900">{monthStats.overdue}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Ukupno računa:</span>
          <span className="font-semibold text-gray-900">{monthStats.total}</span>
        </div>
        <div className="border-t border-gray-300 my-2"></div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Izlazni računi:</span>
          <span className="font-semibold text-green-600">€{monthStats.outgoingPaid.toLocaleString('hr-HR')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Ulazni računi:</span>
          <span className="font-semibold text-red-600">€{monthStats.incomingPaid.toLocaleString('hr-HR')}</span>
        </div>
        <div className="border-t border-gray-300 my-2"></div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 font-medium">NETO (Prihodi - Troškovi):</span>
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
                <div className="border-t border-gray-300 my-2"></div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Planirani budžet (Rashodi):</span>
                  <span className="font-semibold text-blue-600">€{budget.budget_amount.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 font-medium">Razlika od budžeta:</span>
                  <span className={`font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{Math.abs(difference).toLocaleString('hr-HR')} {difference >= 0 ? '(Ispod budžeta - dobro)' : '(Preko budžeta - loše)'}
                  </span>
                </div>
              </>
            )
          }
          return null
        })()}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {monthNames[month]} {year}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleOpenBudgetModal}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <DollarSign className="w-4 h-4" />
              <span>Namjesti Budžet</span>
            </button>
            <button
              onClick={handlePreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dayNames.map(day => (
            <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
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
                  ${isToday ? 'border-blue-500 bg-blue-50 font-bold' : 'border-gray-200'}
                  ${isSelected ? 'ring-2 ring-blue-500 bg-blue-100' : 'hover:bg-gray-50'}
                  ${dayInvoices.length > 0 ? 'font-semibold' : ''}
                `}
              >
                <div className="text-gray-900">{day}</div>
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
            <span className="text-gray-600">Plaćeno</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-gray-600">Neplaćeno</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-gray-600">Overdue</span>
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
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-bold text-gray-900">
              Računi za {selectedDate.getDate()}. {monthNames[selectedDate.getMonth()]} - {selectedInvoices.length} računa
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Broj Računa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tip</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Dobavljač/Kupac</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Moja Firma</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kategorija</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Osnovica</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">PDV</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Ukupno</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Plaćeno</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {selectedInvoices.map(invoice => {
                  const isOverdue = new Date(invoice.due_date) < today && invoice.status !== 'PAID'

                  return (
                    <tr
                      key={invoice.id}
                      className={`hover:bg-gray-50 ${
                        invoice.status === 'PAID'
                          ? 'bg-green-50'
                          : isOverdue
                          ? 'bg-red-50'
                          : 'bg-yellow-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm text-gray-900">{invoice.invoice_number}</span>
                          {isOverdue && (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{getTypeLabel(invoice)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {invoice.bank_company?.name || invoice.office_supplier?.name || invoice.supplier?.name || invoice.customer?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{invoice.company?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{invoice.category || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">€{invoice.base_amount.toLocaleString('hr-HR')}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">€{invoice.vat_amount.toLocaleString('hr-HR')}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">€{invoice.total_amount.toLocaleString('hr-HR')}</td>
                      <td className={`px-4 py-3 text-right text-sm font-semibold ${
                        invoice.invoice_type.startsWith('OUTGOING') || invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE'
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        €{invoice.paid_amount.toLocaleString('hr-HR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                            invoice.status === 'PAID'
                              ? 'bg-green-100 text-green-800'
                              : invoice.status === 'PARTIALLY_PAID'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {invoice.status === 'PAID'
                            ? 'Plaćeno'
                            : invoice.status === 'PARTIALLY_PAID'
                            ? 'Djelomično'
                            : 'Neplaćeno'}
                        </span>
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
