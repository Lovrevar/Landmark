import React from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Edit, Trash2 } from 'lucide-react'
import { Payment, VisibleColumns } from './types'
import { getPaymentMethodLabel, getPaymentMethodColor } from '../services/paymentHelpers'
import { paymentDirection } from '../services/invoiceHelpers'
import { DIRECTION_AMOUNT_CLASS } from '../services/paymentTotals'
import { formatEuro, formatDate } from '../../../utils/formatters'
import { Table, Button, EmptyState } from '../../ui'

interface PaymentTableProps {
  payments: Payment[]
  visibleColumns: VisibleColumns
  onView: (payment: Payment) => void
  onEdit: (payment: Payment) => void
  onDelete: (id: string) => void
}

const PaymentTable: React.FC<PaymentTableProps> = ({
  payments,
  visibleColumns,
  onView,
  onEdit,
  onDelete
}) => {
  const { t, i18n } = useTranslation()
  return (
    <Table>
      <Table.Head>
        <tr>
          {visibleColumns.payment_date && <Table.Th>{t('payments.table.payment_date')}</Table.Th>}
          {visibleColumns.invoice_number && <Table.Th>{t('payments.table.invoice_number')}</Table.Th>}
          {visibleColumns.my_company && <Table.Th>{t('payments.table.my_company')}</Table.Th>}
          {visibleColumns.invoice_type && <Table.Th>{t('payments.table.invoice_type')}</Table.Th>}
          {visibleColumns.company_supplier && <Table.Th>{t('payments.table.company_supplier')}</Table.Th>}
          {visibleColumns.amount && <Table.Th>{t('payments.table.amount')}</Table.Th>}
          {visibleColumns.payment_method && <Table.Th>{t('payments.table.payment_method')}</Table.Th>}
          {visibleColumns.reference_number && <Table.Th>{t('payments.table.reference_number')}</Table.Th>}
          {visibleColumns.description && <Table.Th>{t('payments.table.description')}</Table.Th>}
          <Table.Th sticky>{t('payments.table.actions')}</Table.Th>
        </tr>
      </Table.Head>
      <Table.Body>
        {payments.length === 0 ? (
          <tr>
            <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}>
              <EmptyState
                icon={CreditCard}
                title={t('payments.table.no_payments')}
              />
            </td>
          </tr>
        ) : (
          payments.map((payment) => {
            const invoice = payment.accounting_invoices
            if (!invoice) return null

            // The amount takes the direction's colour. It used to be green on every row —
            // including the rows the type column beside it marked RASHOD in red.
            const direction = paymentDirection(invoice.invoice_type)

            return (
              <Table.Tr key={payment.id} onClick={() => onView(payment)} className="cursor-pointer">
                {visibleColumns.payment_date && (
                  <Table.Td label={t('payments.table.payment_date')}>
                    {formatDate(payment.payment_date, i18n.language)}
                  </Table.Td>
                )}
                {visibleColumns.invoice_number && (
                  <Table.Td label={t('payments.table.invoice_number')} className="font-medium">
                    {invoice.invoice_number}
                  </Table.Td>
                )}
                {visibleColumns.my_company && (
                  <Table.Td label={t('payments.table.my_company')} className="text-gray-700 dark:text-gray-200">
                    {invoice.companies?.name || '-'}
                  </Table.Td>
                )}
                {visibleColumns.invoice_type && (
                  <Table.Td label={t('payments.table.invoice_type')}>
                    <span className={`text-xs font-semibold ${
                      direction ? DIRECTION_AMOUNT_CLASS[direction] : 'text-gray-900 dark:text-white'}`}>
                      {direction === 'OUT' ? t('payments.table.expense') : t('payments.table.income')}
                    </span>
                  </Table.Td>
                )}
                {visibleColumns.company_supplier && (
                  <Table.Td label={t('payments.table.company_supplier')}>
                    {invoice.bank_company?.name ||
                     invoice.office_suppliers?.name ||
                     invoice.retail_suppliers?.name ||
                     invoice.subcontractors?.name ||
                     (invoice.customers ? `${invoice.customers.name} ${invoice.customers.surname}` : '') ||
                     invoice.companies?.name ||
                     '-'}
                  </Table.Td>
                )}
                {visibleColumns.amount && (
                  <Table.Td
                    label={t('payments.table.amount')}
                    className={`font-semibold ${direction ? DIRECTION_AMOUNT_CLASS[direction] : 'text-gray-900 dark:text-white'}`}
                  >
                    {formatEuro(payment.amount)}
                  </Table.Td>
                )}
                {visibleColumns.payment_method && (
                  <Table.Td label={t('payments.table.payment_method')}>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentMethodColor(payment.payment_method, payment.payment_source_type)}`}>
                      {getPaymentMethodLabel(payment.payment_method, payment.payment_source_type, t)}
                    </span>
                  </Table.Td>
                )}
                {visibleColumns.reference_number && (
                  <Table.Td label={t('payments.table.reference_number')} className="text-gray-600 dark:text-gray-400">
                    {payment.reference_number || '-'}
                  </Table.Td>
                )}
                {visibleColumns.description && (
                  <Table.Td label={t('payments.table.description')} className="text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {payment.is_cesija && payment.cesija_company_name ? (
                      <span className="font-medium text-purple-700 dark:text-purple-400">
                        {t('payments.cesija_prefix')}{payment.cesija_company_name}
                      </span>
                    ) : (
                      payment.description || '-'
                    )}
                  </Table.Td>
                )}
                <Table.Td sticky>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost-primary"
                      size="icon-sm"
                      icon={Edit}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(payment)
                      }}
                      title="Uredi"
                    />
                    <Button
                      variant="ghost-danger"
                      size="icon-sm"
                      icon={Trash2}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(payment.id)
                      }}
                      title="Obriši"
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
