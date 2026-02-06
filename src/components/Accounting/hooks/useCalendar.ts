import { useState, useEffect } from 'react'
import { Invoice, MonthlyBudget } from '../types/calendarTypes'
import { fetchInvoices as fetchInvoicesService, fetchBudgets as fetchBudgetsService } from '../services/calendarService'

export const useCalendar = () => {
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
      const data = await fetchInvoicesService()
      setInvoices(data)
    } finally {
      setLoading(false)
    }
  }

  const fetchBudgets = async () => {
    const data = await fetchBudgetsService()
    setBudgets(data)
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

  const getCurrentMonthBudget = () => {
    const { year, month } = getDaysInMonth(currentDate)
    return budgets.find(b => b.year === year && b.month === month + 1)
  }

  return {
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
  }
}
