import React from 'react'
import { Payment } from '../types/paymentTypes'
import { StatCard } from '../../ui'

interface PaymentStatsCardsProps {
  payments: Payment[]
}

const PaymentStatsCards: React.FC<PaymentStatsCardsProps> = ({ payments }) => {
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('hr-HR')

  const thisMonthAmount = payments
    .filter(p => {
      const paymentMonth = new Date(p.payment_date).getMonth()
      const currentMonth = new Date().getMonth()
      const paymentYear = new Date(p.payment_date).getFullYear()
      const currentYear = new Date().getFullYear()
      return paymentMonth === currentMonth && paymentYear === currentYear
    })
    .reduce((sum, p) => sum + p.amount, 0)
    .toLocaleString('hr-HR')

  const vatInAmount = payments
    .filter(p => {
      const invoice = p.accounting_invoices
      return invoice && (invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE')
    })
    .reduce((sum, p) => {
      const invoice = p.accounting_invoices
      if (!invoice) return sum
      const vatRatio = p.amount / invoice.total_amount
      return sum + (invoice.vat_amount * vatRatio)
    }, 0)
    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const vatOutAmount = payments
    .filter(p => {
      const invoice = p.accounting_invoices
      return invoice && (invoice.invoice_type === 'INCOMING_INVESTMENT' || invoice.invoice_type === 'OUTGOING_SALES' || invoice.invoice_type === 'OUTGOING_OFFICE')
    })
    .reduce((sum, p) => {
      const invoice = p.accounting_invoices
      if (!invoice) return sum
      const vatRatio = p.amount / invoice.total_amount
      return sum + (invoice.vat_amount * vatRatio)
    }, 0)
    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const totalExpense = payments
    .filter(p => {
      const invoice = p.accounting_invoices
      return invoice && (invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_BANK')
    })
    .reduce((sum, p) => sum + p.amount, 0)
    .toLocaleString('hr-HR')

  const totalIncome = payments
    .filter(p => {
      const invoice = p.accounting_invoices
      return invoice && (invoice.invoice_type === 'INCOMING_INVESTMENT' || invoice.invoice_type === 'OUTGOING_SALES' || invoice.invoice_type === 'OUTGOING_OFFICE')
    })
    .reduce((sum, p) => sum + p.amount, 0)
    .toLocaleString('hr-HR')

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <StatCard
        label="Ukupno plaćanja"
        value={payments.length}
        color="white"
      />

      <StatCard
        label="Ukupan iznos"
        value={`€${totalAmount}`}
        color="white"
      />

      <StatCard
        label="Ovaj mjesec"
        value={`€${thisMonthAmount}`}
        color="blue"
      />

      <StatCard
        label="PDV Ulaz"
        value={`€${vatInAmount}`}
        color="red"
      />

      <StatCard
        label="PDV Izlaz"
        value={`€${vatOutAmount}`}
        color="green"
      />

      <StatCard
        label="Ukupno Rashod"
        value={`€${totalExpense}`}
        color="red"
      />

      <StatCard
        label="Ukupno Prihod"
        value={`€${totalIncome}`}
        color="green"
      />
    </div>
  )
}

export default PaymentStatsCards
