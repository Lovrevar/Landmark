import React from 'react'
import { Payment } from '../types/paymentTypes'

interface PaymentStatsCardsProps {
  payments: Payment[]
}

const PaymentStatsCards: React.FC<PaymentStatsCardsProps> = ({ payments }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col">
          <p className="text-xs text-gray-600 mb-1">Ukupno plaćanja</p>
          <p className="text-xl font-bold text-gray-900">{payments.length}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col">
          <p className="text-xs text-gray-600 mb-1">Ukupan iznos</p>
          <p className="text-xl font-bold text-gray-900">
            €{payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('hr-HR')}
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col">
          <p className="text-xs text-gray-600 mb-1">Ovaj mjesec</p>
          <p className="text-xl font-bold text-blue-600">
            €{payments
              .filter(p => {
                const paymentMonth = new Date(p.payment_date).getMonth()
                const currentMonth = new Date().getMonth()
                const paymentYear = new Date(p.payment_date).getFullYear()
                const currentYear = new Date().getFullYear()
                return paymentMonth === currentMonth && paymentYear === currentYear
              })
              .reduce((sum, p) => sum + p.amount, 0)
              .toLocaleString('hr-HR')}
          </p>
        </div>
      </div>

      <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200">
        <div className="flex flex-col">
          <p className="text-xs text-red-700 mb-1">PDV Ulaz</p>
          <p className="text-xl font-bold text-red-900">
            €{payments
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
              .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
        <div className="flex flex-col">
          <p className="text-xs text-green-700 mb-1">PDV Izlaz</p>
          <p className="text-xl font-bold text-green-900">
            €{payments
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
              .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200">
        <div className="flex flex-col">
          <p className="text-xs text-red-700 mb-1">Ukupno Rashod</p>
          <p className="text-xl font-bold text-red-900">
            €{payments
              .filter(p => {
                const invoice = p.accounting_invoices
                return invoice && (invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_BANK')
              })
              .reduce((sum, p) => sum + p.amount, 0)
              .toLocaleString('hr-HR')}
          </p>
        </div>
      </div>

      <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
        <div className="flex flex-col">
          <p className="text-xs text-green-700 mb-1">Ukupno Prihod</p>
          <p className="text-xl font-bold text-green-900">
            €{payments
              .filter(p => {
                const invoice = p.accounting_invoices
                return invoice && (invoice.invoice_type === 'INCOMING_INVESTMENT' || invoice.invoice_type === 'OUTGOING_SALES' || invoice.invoice_type === 'OUTGOING_OFFICE')
              })
              .reduce((sum, p) => sum + p.amount, 0)
              .toLocaleString('hr-HR')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default PaymentStatsCards
