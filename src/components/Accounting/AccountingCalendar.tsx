import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, CheckCircle, Clock, DollarSign, X } from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'INCOMING_BANK' | 'OUTGOING_BANK'
  supplier_id: string | null
  customer_id: string | null
  office_supplier_id: string | null
  due_date: string
  total_amount: number
  base_amount: number
  vat_amount: number
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
  paid_amount: number
  remaining_amount: number
  company_id: string
  category: string | null
  company?: { name: string }
  supplier?: { name: string }
  customer?: { name: string }
  office_supplier?: { name: string }
  bank_company?: { name: string }
}

interface MonthlyBudget {
  id: string
  year: number
  month: number
  budget_amount: number
  notes: string
}

const AccountingCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedInvoices, setSelectedInvoices] = useState<Invoice[]>([])
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([])
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear())
  const [budgetFormData, setBudgetFormData] = useState<{ [key: number]: number }>({})

  useEffect(() => {
    fetchInvoices()
    fetchBudgets()
  }, [currentDate])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('accounting_invoices')
        .select(`
          *,
          company:accounting_companies!accounting_invoices_company_id_fkey(name),
          supplier:subcontractors(name),
          customer:customers(name),
          office_supplier:office_suppliers(name),
          bank_company:bank_id(name)
        `)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })

      if (error) throw error
      setInvoices(data || [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_budgets')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: true })

      if (error) throw error
      setBudgets(data || [])
    } catch (error) {
      console.error('Error fetching budgets:', error)
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const getInvoicesForDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    return invoices.filter(inv => inv.due_date?.split('T')[0] === dateStr)
  }

  const getMonthStats = () => {
    const { year, month } = getDaysInMonth(currentDate)
    const monthInvoices = invoices.filter(inv => {
      const dateParts = inv.due_date.split('T')[0].split('-')
      const invYear = parseInt(dateParts[0])
      const invMonth = parseInt(dateParts[1]) - 1
      return invYear === year && invMonth === month
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const incomingInvoices = monthInvoices.filter(inv =>
      inv.invoice_type === 'INCOMING_SUPPLIER' ||
      inv.invoice_type === 'INCOMING_INVESTMENT' ||
      inv.invoice_type === 'INCOMING_OFFICE' ||
      inv.invoice_type === 'INCOMING_BANK'
    )

    const outgoingInvoices = monthInvoices.filter(inv =>
      inv.invoice_type === 'OUTGOING_SUPPLIER' ||
      inv.invoice_type === 'OUTGOING_SALES' ||
      inv.invoice_type === 'OUTGOING_OFFICE' ||
      inv.invoice_type === 'OUTGOING_BANK'
    )

    const incomingPaid = incomingInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + inv.total_amount, 0)
    const outgoingPaid = outgoingInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + inv.total_amount, 0)
    const netAmount = outgoingPaid - incomingPaid

    return {
      total: monthInvoices.length,
      paid: monthInvoices.filter(inv => inv.status === 'PAID').length,
      unpaid: monthInvoices.filter(inv => inv.status === 'UNPAID').length,
      overdue: monthInvoices.filter(inv => {
        const dateParts = inv.due_date.split('T')[0].split('-')
        const dueDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]))
        dueDate.setHours(0, 0, 0, 0)
        return inv.status !== 'PAID' && dueDate < today
      }).length,
      totalAmount: monthInvoices.reduce((sum, inv) => sum + inv.total_amount, 0),
      paidAmount: monthInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + inv.total_amount, 0),
      unpaidAmount: monthInvoices.filter(inv => inv.status !== 'PAID').reduce((sum, inv) => sum + inv.total_amount, 0),
      incomingPaid,
      outgoingPaid,
      netAmount
    }
  }

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(clickedDate)
    setSelectedInvoices(getInvoicesForDate(clickedDate))
  }

  const handleOpenBudgetModal = () => {
    const initialData: { [key: number]: number } = {}
    for (let m = 1; m <= 12; m++) {
      const existing = budgets.find(b => b.year === budgetYear && b.month === m)
      initialData[m] = existing?.budget_amount || 0
    }
    setBudgetFormData(initialData)
    setShowBudgetModal(true)
  }

  const handleSaveBudgets = async () => {
    try {
      for (let m = 1; m <= 12; m++) {
        const amount = budgetFormData[m] || 0
        const existing = budgets.find(b => b.year === budgetYear && b.month === m)

        if (existing) {
          await supabase
            .from('monthly_budgets')
            .update({ budget_amount: amount })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('monthly_budgets')
            .insert({
              year: budgetYear,
              month: m,
              budget_amount: amount,
              notes: ''
            })
        }
      }

      await fetchBudgets()
      setShowBudgetModal(false)
    } catch (error) {
      console.error('Error saving budgets:', error)
    }
  }

  const getCurrentMonthBudget = () => {
    return budgets.find(b => b.year === year && b.month === month + 1)
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate)
  const monthStats = getMonthStats()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const monthNames = [
    'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
    'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'
  ]

  const dayNames = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Month Statistics */}
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

      {/* Amount Statistics */}
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
            €{monthStats.netAmount.toLocaleString()}
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
                  <span className="font-semibold text-blue-600">€{budget.budget_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 font-medium">Razlika od budžeta:</span>
                  <span className={`font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{Math.abs(difference).toLocaleString()} {difference >= 0 ? '(Ispod budžeta - dobro)' : '(Preko budžeta - loše)'}
                  </span>
                </div>
              </>
            )
          }
          return null
        })()}
      </div>

      {/* Calendar Header */}
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

        {/* Calendar Grid */}
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

        {/* Legend */}
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

      {/* Selected Date Invoices - Table View */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Namjesti Godišnji Budžet</h2>
              <button
                onClick={() => setShowBudgetModal(false)}
                className="text-white hover:bg-green-800 rounded-lg p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Godina
                </label>
                <select
                  value={budgetYear}
                  onChange={(e) => {
                    setBudgetYear(parseInt(e.target.value))
                    const initialData: { [key: number]: number } = {}
                    const newYear = parseInt(e.target.value)
                    for (let m = 1; m <= 12; m++) {
                      const existing = budgets.find(b => b.year === newYear && b.month === m)
                      initialData[m] = existing?.budget_amount || 0
                    }
                    setBudgetFormData(initialData)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthNames.map((monthName, idx) => {
                  const monthNum = idx + 1
                  return (
                    <div key={monthNum} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {monthName}
                      </label>
                      <input
                        type="number"
                        value={budgetFormData[monthNum] || 0}
                        onChange={(e) => setBudgetFormData({
                          ...budgetFormData,
                          [monthNum]: parseFloat(e.target.value) || 0
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                        min="0"
                        step="1000"
                      />
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-blue-900">Ukupan godišnji budžet:</span>
                  <span className="font-bold text-blue-900 text-lg">
                    €{Object.values(budgetFormData).reduce((sum, val) => sum + (val || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
              <button
                onClick={() => setShowBudgetModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Odustani
              </button>
              <button
                onClick={handleSaveBudgets}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Spremi Budžete
              </button>
            </div>
          </div>
        </div>
      )}

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
                  const getTypeLabel = () => {
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
                      <td className="px-4 py-3 text-xs text-gray-700">{getTypeLabel()}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {invoice.bank_company?.name || invoice.office_supplier?.name || invoice.supplier?.name || invoice.customer?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{invoice.company?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{invoice.category || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">€{invoice.base_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">€{invoice.vat_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">€{invoice.total_amount.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right text-sm font-semibold ${
                        invoice.invoice_type.startsWith('OUTGOING') || invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE'
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        €{invoice.paid_amount.toLocaleString()}
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
