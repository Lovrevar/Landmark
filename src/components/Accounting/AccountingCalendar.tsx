import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, CheckCircle, Clock } from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES'
  supplier_id: string | null
  customer_id: string | null
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
}

const AccountingCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedInvoices, setSelectedInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    fetchInvoices()
  }, [currentDate])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('accounting_invoices')
        .select(`
          *,
          company:accounting_companies(name),
          supplier:subcontractors(name),
          customer:customers(name)
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
    const dateStr = date.toISOString().split('T')[0]
    return invoices.filter(inv => inv.due_date?.split('T')[0] === dateStr)
  }

  const getMonthStats = () => {
    const { year, month } = getDaysInMonth(currentDate)
    const monthInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.due_date)
      return invDate.getFullYear() === year && invDate.getMonth() === month
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return {
      total: monthInvoices.length,
      paid: monthInvoices.filter(inv => inv.status === 'PAID').length,
      unpaid: monthInvoices.filter(inv => inv.status === 'UNPAID').length,
      overdue: monthInvoices.filter(inv => {
        const dueDate = new Date(inv.due_date)
        dueDate.setHours(0, 0, 0, 0)
        return inv.status !== 'PAID' && dueDate < today
      }).length,
      totalAmount: monthInvoices.reduce((sum, inv) => sum + inv.total_amount, 0),
      paidAmount: monthInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + inv.total_amount, 0),
      unpaidAmount: monthInvoices.filter(inv => inv.status !== 'PAID').reduce((sum, inv) => sum + inv.total_amount, 0)
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
          <span className="text-gray-600">Ukupan iznos:</span>
          <span className="font-semibold text-gray-900">€{monthStats.totalAmount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Plaćeno:</span>
          <span className="font-semibold text-green-600">€{monthStats.paidAmount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Neplaćeno:</span>
          <span className="font-semibold text-red-600">€{monthStats.unpaidAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {monthNames[month]} {year}
          </h3>
          <div className="flex space-x-2">
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
              const dueDate = new Date(inv.due_date)
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
                      case 'OUTGOING_SUPPLIER': return 'Izlazni - Dobavljač'
                      case 'OUTGOING_SALES': return 'Izlazni - Prodaja'
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
                        {invoice.supplier?.name || invoice.customer?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{invoice.company?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{invoice.category || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">€{invoice.base_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">€{invoice.vat_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">€{invoice.total_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">€{invoice.paid_amount.toLocaleString()}</td>
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
