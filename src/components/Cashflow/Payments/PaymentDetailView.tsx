import React from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { formatCurrency } from '../../Common/CurrencyInput'
import type { Payment } from './types'
import { Modal, Button } from '../../ui'
import { getPaymentMethodLabel } from '../services/paymentHelpers'

interface PaymentDetailViewProps {
  payment: Payment | null
  onClose: () => void
}

export const PaymentDetailView: React.FC<PaymentDetailViewProps> = ({
  payment,
  onClose
}) => {
  const { t } = useTranslation()
  if (!payment) return null

  const invoice = payment.accounting_invoices

  const getInvoiceTypeLabel = (type: string) => {
    switch (type) {
      case 'INCOMING_SUPPLIER':
        return t('payments.detail.type_incoming_supplier')
      case 'OUTGOING_SUPPLIER':
        return t('payments.detail.type_outgoing_supplier')
      case 'INCOMING_INVESTMENT':
        return t('payments.detail.type_incoming_investment')
      case 'OUTGOING_SALES':
        return t('payments.detail.type_outgoing_sales')
      case 'INCOMING_OFFICE':
        return t('payments.detail.type_incoming_office')
      case 'OUTGOING_OFFICE':
        return t('payments.detail.type_outgoing_office')
      case 'INCOMING_BANK':
        return t('payments.detail.type_incoming_bank')
      case 'OUTGOING_BANK':
        return t('payments.detail.type_outgoing_bank')
      default:
        return type
    }
  }

  const getSupplierCustomerName = () => {
    if (!invoice) return '-'
    return (
      invoice.bank_company?.name ||
      invoice.office_suppliers?.name ||
      invoice.retail_suppliers?.name ||
      invoice.subcontractors?.name ||
      (invoice.customers ? `${invoice.customers.name} ${invoice.customers.surname}` : '') ||
      invoice.companies?.name ||
      '-'
    )
  }

  const isExpense = invoice?.invoice_type.startsWith('INCOMING_') ?? false

  const getPaymentSourceTypeLabel = () => {
    if (payment.is_cesija) return 'Cesija'
    switch (payment.payment_source_type) {
      case 'bank_account': return t('payments.detail.source_bank')
      case 'credit': return t('payments.detail.source_credit')
      case 'kompenzacija': return t('payments.detail.source_kompenzacija')
      default: return '-'
    }
  }

  const getPaymentSourceName = () => {
    if (payment.is_cesija) return payment.cesija_company_name || '-'
    if (payment.payment_source_type === 'bank_account') {
      return payment.company_bank_accounts?.bank_name || '-'
    }
    if (payment.payment_source_type === 'credit') {
      return payment.bank_credits?.credit_name || '-'
    }
    return '-'
  }

  return (
    <Modal show={!!payment} onClose={onClose} size="lg">
      <Modal.Header title={t('payments.detail.title')} onClose={onClose} />

      <Modal.Body className="px-6 py-4 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">{t('payments.detail.basic_info')}</h3>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500">{t('payments.detail.payment_date')}</span>
                <p className="text-sm font-medium text-gray-900">
                  {format(new Date(payment.payment_date), 'dd.MM.yyyy')}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">{t('payments.detail.payment_method')}</span>
                <p className="text-sm font-medium text-gray-900">
                  {getPaymentMethodLabel(payment.payment_method)}
                </p>
              </div>
              {payment.reference_number && (
                <div>
                  <span className="text-sm text-gray-500">{t('payments.detail.reference_number')}</span>
                  <p className="text-sm font-medium text-gray-900">{payment.reference_number}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-500">{t('payments.detail.payment_amount')}</span>
                <p className="text-lg font-bold text-green-600">
                  &euro;{formatCurrency(payment.amount)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">{t('payments.detail.source_type')}</span>
                <p className="text-sm font-medium text-gray-900">{getPaymentSourceTypeLabel()}</p>
              </div>
              {payment.payment_source_type !== 'kompenzacija' && !payment.is_cesija && (
                <div>
                  <span className="text-sm text-gray-500">{t('payments.detail.source_name')}</span>
                  <p className="text-sm font-medium text-gray-900">{getPaymentSourceName()}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">{t('payments.detail.invoice')}</h3>
            <div className="space-y-2">
              {invoice && (
                <>
                  <div>
                    <span className="text-sm text-gray-500">{t('payments.detail.invoice_number')}</span>
                    <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">{t('payments.detail.invoice_type')}</span>
                    <p className={`text-sm font-semibold ${isExpense ? 'text-red-600' : 'text-green-600'}`}>
                      {getInvoiceTypeLabel(invoice.invoice_type)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">{t('payments.detail.invoice_total')}</span>
                    <p className="text-sm font-medium text-gray-900">
                      &euro;{formatCurrency(invoice.total_amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">{t('payments.detail.invoice_remaining')}</span>
                    <p className={`text-sm font-medium ${invoice.remaining_amount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      &euro;{formatCurrency(invoice.remaining_amount)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {invoice && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">{t('payments.detail.entities')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">{t('payments.detail.my_company')}</span>
                <p className="text-sm font-medium text-gray-900">{invoice.companies?.name || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">{t('payments.detail.company_supplier')}</span>
                <p className="text-sm font-medium text-gray-900">{getSupplierCustomerName()}</p>
              </div>
            </div>
          </div>
        )}

        {payment.is_cesija && payment.cesija_company_name && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">{t('payments.detail.cesija_section')}</h3>
            <div className="bg-purple-50 p-3 rounded">
              <div className="flex items-center gap-2">
                <span className="text-sm text-purple-700 font-medium">{t('payments.detail.cesija_label')}</span>
              </div>
              <div className="mt-2">
                <span className="text-sm text-purple-600">{t('payments.detail.cesija_company')}</span>
                <p className="text-sm font-medium text-purple-900">{payment.cesija_company_name}</p>
              </div>
            </div>
          </div>
        )}

        {payment.description && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">{t('payments.detail.description')}</h3>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{payment.description}</p>
          </div>
        )}

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">{t('payments.detail.additional_info')}</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-500">{t('payments.detail.created_at')}</span>
              <p className="text-sm font-medium text-gray-900">
                {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm')}
              </p>
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer sticky>
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
