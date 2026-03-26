import React from 'react'
import { useTranslation } from 'react-i18next'
import { Payment } from './types'
import { StatCard } from '../../ui'

interface PaymentStatsCardsProps {
  payments: Payment[]
}

const PaymentStatsCards: React.FC<PaymentStatsCardsProps> = ({ payments }) => {
  const { t } = useTranslation()
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
      return invoice && invoice.invoice_type.startsWith('INCOMING_')
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
      return invoice && invoice.invoice_type.startsWith('OUTGOING_')
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
      return invoice && invoice.invoice_type.startsWith('INCOMING_')
    })
    .reduce((sum, p) => sum + p.amount, 0)
    .toLocaleString('hr-HR')

  const totalIncome = payments
    .filter(p => {
      const invoice = p.accounting_invoices
      return invoice && invoice.invoice_type.startsWith('OUTGOING_')
    })
    .reduce((sum, p) => sum + p.amount, 0)
    .toLocaleString('hr-HR')

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <StatCard
        label={t('payments.stats.total_count')}
        value={payments.length}
        color="white"
      />

      <StatCard
        label={t('payments.stats.total_amount')}
        value={`€${totalAmount}`}
        color="white"
      />

      <StatCard
        label={t('payments.stats.this_month')}
        value={`€${thisMonthAmount}`}
        color="blue"
      />

      <StatCard
        label={t('payments.stats.vat_in')}
        value={`€${vatInAmount}`}
        color="red"
      />

      <StatCard
        label={t('payments.stats.vat_out')}
        value={`€${vatOutAmount}`}
        color="green"
      />

      <StatCard
        label={t('payments.stats.total_expense')}
        value={`€${totalExpense}`}
        color="red"
      />

      <StatCard
        label={t('payments.stats.total_income')}
        value={`€${totalIncome}`}
        color="green"
      />
    </div>
  )
}

export default PaymentStatsCards
