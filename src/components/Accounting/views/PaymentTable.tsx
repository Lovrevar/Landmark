import React from 'react'
import { CreditCard, Edit, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Payment, VisibleColumns } from '../types/paymentTypes'
import { getPaymentMethodLabel, getPaymentMethodColor } from '../utils/paymentHelpers'

interface PaymentTableProps {
  payments: Payment[]
  visibleColumns: VisibleColumns
  onEdit: (payment: Payment) => void
  onDelete: (id: string) => void
}

const PaymentTable: React.FC<PaymentTableProps> = ({
  payments,
  visibleColumns,
  onEdit,
  onDelete
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              {visibleColumns.payment_date && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum plaćanja</th>}
              {visibleColumns.invoice_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj računa</th>}
              {visibleColumns.my_company && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moja Firma</th>}
              {visibleColumns.invoice_type && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>}
              {visibleColumns.company_supplier && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma/Dobavljač</th>}
              {visibleColumns.amount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Iznos</th>}
              {visibleColumns.payment_method && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Način plaćanja</th>}
              {visibleColumns.reference_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referenca</th>}
              {visibleColumns.description && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opis</th>}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50">Akcije</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="px-6 py-12 text-center">
                  <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nema pronađenih plaćanja</p>
                </td>
              </tr>
            ) : (
              payments.map((payment) => {
                const invoice = payment.accounting_invoices
                if (!invoice) return null

                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    {visibleColumns.payment_date && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(payment.payment_date), 'dd.MM.yyyy')}
                      </td>
                    )}
                    {visibleColumns.invoice_number && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </td>
                    )}
                    {visibleColumns.my_company && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {invoice.companies?.name || '-'}
                      </td>
                    )}
                    {visibleColumns.invoice_type && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`text-xs font-semibold ${
                          invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_BANK'
                          ? 'text-red-600' : 'text-green-600'}`}>
                          {invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_BANK'
                          ? 'RASHOD' : 'PRIHOD'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.company_supplier && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.bank_company?.name ||
                         invoice.office_suppliers?.name ||
                         invoice.subcontractors?.name ||
                         (invoice.customers ? `${invoice.customers.name} ${invoice.customers.surname}` : '') ||
                         invoice.companies?.name ||
                         '-'}
                      </td>
                    )}
                    {visibleColumns.amount && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        €{payment.amount.toLocaleString('hr-HR')}
                      </td>
                    )}
                    {visibleColumns.payment_method && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentMethodColor(payment.payment_method)}`}>
                          {getPaymentMethodLabel(payment.payment_method)}
                        </span>
                      </td>
                    )}
                    {visibleColumns.reference_number && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {payment.reference_number || '-'}
                      </td>
                    )}
                    {visibleColumns.description && (
                      <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {payment.is_cesija && payment.cesija_company_name ? (
                          <span className="font-medium text-purple-700">
                            Cesija - {payment.cesija_company_name}
                          </span>
                        ) : (
                          payment.description || '-'
                        )}
                      </td>
                    )}
                    <td className="px-4 py-4 whitespace-nowrap text-sm sticky right-0 bg-white">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onEdit(payment)}
                          title="Uredi"
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(payment.id)}
                          title="Obriši"
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PaymentTable
