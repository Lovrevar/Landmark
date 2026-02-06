import React from 'react'
import { CreditCard, Edit, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Payment, VisibleColumns } from '../types/paymentTypes'
import { getPaymentMethodLabel, getPaymentMethodColor } from '../utils/paymentHelpers'
import { Table, Button, EmptyState } from '../../ui'

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
    <Table>
      <Table.Head>
        <tr>
          {visibleColumns.payment_date && <Table.Th>Datum plaćanja</Table.Th>}
          {visibleColumns.invoice_number && <Table.Th>Broj računa</Table.Th>}
          {visibleColumns.my_company && <Table.Th>Moja Firma</Table.Th>}
          {visibleColumns.invoice_type && <Table.Th>Tip</Table.Th>}
          {visibleColumns.company_supplier && <Table.Th>Firma/Dobavljač</Table.Th>}
          {visibleColumns.amount && <Table.Th>Iznos</Table.Th>}
          {visibleColumns.payment_method && <Table.Th>Način plaćanja</Table.Th>}
          {visibleColumns.reference_number && <Table.Th>Referenca</Table.Th>}
          {visibleColumns.description && <Table.Th>Opis</Table.Th>}
          <Table.Th sticky>Akcije</Table.Th>
        </tr>
      </Table.Head>
      <Table.Body>
        {payments.length === 0 ? (
          <tr>
            <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}>
              <EmptyState
                icon={CreditCard}
                title="Nema pronađenih plaćanja"
              />
            </td>
          </tr>
        ) : (
          payments.map((payment) => {
            const invoice = payment.accounting_invoices
            if (!invoice) return null

            return (
              <Table.Tr key={payment.id}>
                {visibleColumns.payment_date && (
                  <Table.Td>
                    {format(new Date(payment.payment_date), 'dd.MM.yyyy')}
                  </Table.Td>
                )}
                {visibleColumns.invoice_number && (
                  <Table.Td className="font-medium">
                    {invoice.invoice_number}
                  </Table.Td>
                )}
                {visibleColumns.my_company && (
                  <Table.Td className="text-gray-700">
                    {invoice.companies?.name || '-'}
                  </Table.Td>
                )}
                {visibleColumns.invoice_type && (
                  <Table.Td>
                    <span className={`text-xs font-semibold ${
                      invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_BANK'
                      ? 'text-red-600' : 'text-green-600'}`}>
                      {invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_BANK'
                      ? 'RASHOD' : 'PRIHOD'}
                    </span>
                  </Table.Td>
                )}
                {visibleColumns.company_supplier && (
                  <Table.Td>
                    {invoice.bank_company?.name ||
                     invoice.office_suppliers?.name ||
                     invoice.subcontractors?.name ||
                     (invoice.customers ? `${invoice.customers.name} ${invoice.customers.surname}` : '') ||
                     invoice.companies?.name ||
                     '-'}
                  </Table.Td>
                )}
                {visibleColumns.amount && (
                  <Table.Td className="font-semibold text-green-600">
                    €{payment.amount.toLocaleString('hr-HR')}
                  </Table.Td>
                )}
                {visibleColumns.payment_method && (
                  <Table.Td>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentMethodColor(payment.payment_method)}`}>
                      {getPaymentMethodLabel(payment.payment_method)}
                    </span>
                  </Table.Td>
                )}
                {visibleColumns.reference_number && (
                  <Table.Td className="text-gray-600">
                    {payment.reference_number || '-'}
                  </Table.Td>
                )}
                {visibleColumns.description && (
                  <Table.Td className="text-gray-600 max-w-xs truncate">
                    {payment.is_cesija && payment.cesija_company_name ? (
                      <span className="font-medium text-purple-700">
                        Cesija - {payment.cesija_company_name}
                      </span>
                    ) : (
                      payment.description || '-'
                    )}
                  </Table.Td>
                )}
                <Table.Td sticky>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={Edit}
                      onClick={() => onEdit(payment)}
                      title="Uredi"
                      className="text-blue-600 hover:bg-blue-50 bg-transparent"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={Trash2}
                      onClick={() => onDelete(payment.id)}
                      title="Obriši"
                      className="text-red-600 hover:bg-red-50 bg-transparent"
                    />
                  </div>
                </Table.Td>
              </Table.Tr>
            )
          })
        )}
      </Table.Body>
    </Table>
  )
}

export default PaymentTable
