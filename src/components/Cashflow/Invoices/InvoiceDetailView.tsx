import React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { formatCurrency } from '../../Common/CurrencyInput'
import type { Invoice } from './types'
import { Modal, Button } from '../../ui'

interface InvoiceDetailViewProps {
  invoice: Invoice | null
  onClose: () => void
  getTypeColor: (type: string) => string
  getTypeLabel: (type: string) => string
  getStatusColor: (status: string) => string
  getSupplierCustomerName: (invoice: Invoice) => string
  isOverdue: (dueDate: string, status: string) => boolean
}

export const InvoiceDetailView: React.FC<InvoiceDetailViewProps> = ({
  invoice,
  onClose,
  getTypeColor,
  getTypeLabel,
  getStatusColor,
  getSupplierCustomerName,
  isOverdue
}) => {
  const { t } = useTranslation()
  if (!invoice) return null

  return (
    <Modal show={!!invoice} onClose={onClose} size="xl">
      <Modal.Header title={t('invoices.detail.title')} onClose={onClose} />

      <Modal.Body className="px-6 py-4 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t('invoices.detail.basic_info')}</h3>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.number')}</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.type')}</span>
                <p className={`text-sm font-semibold ${getTypeColor(invoice.invoice_type)}`}>
                  {getTypeLabel(invoice.invoice_type)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.status')}</span>
                <p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                    {invoice.status === 'UNPAID' ? t('invoices.detail.status_unpaid') :
                     invoice.status === 'PARTIALLY_PAID' ? t('invoices.detail.status_partial') : t('invoices.detail.status_paid')}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.approved')}</span>
                <p className="flex items-center gap-2">
                  {invoice.approved ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                      <Check className="w-4 h-4" /> {t('common.yes')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                      <X className="w-4 h-4" /> {t('common.no')}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t('invoices.detail.dates')}</h3>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.issue_date')}</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.due_date')}</span>
                <p className={`text-sm font-medium ${isOverdue(invoice.due_date, invoice.status) ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                  {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                  {isOverdue(invoice.due_date, invoice.status) && (
                    <span className="ml-2 text-xs">{t('invoices.detail.overdue')}</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.created_at')}</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {format(new Date(invoice.created_at), 'dd.MM.yyyy HH:mm')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t('invoices.detail.entities')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.company')}</span>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.companies?.name || '-'}</p>
            </div>
            {(invoice.subcontractors || invoice.customers || invoice.investors ||
              invoice.banks || invoice.office_suppliers || invoice.retail_suppliers ||
              invoice.retail_customers) && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {invoice.invoice_type.includes('SUPPLIER') ? t('invoices.detail.partner_supplier') :
                   invoice.invoice_type.includes('SALES') ? t('invoices.detail.partner_customer') :
                   invoice.invoice_type.includes('INVESTMENT') ? t('invoices.detail.partner_investor') :
                   invoice.invoice_type.includes('BANK') ? t('invoices.detail.partner_bank') :
                   invoice.invoice_type.includes('OFFICE') ? t('invoices.detail.partner_office') : t('invoices.detail.partner_other')}
                </span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {getSupplierCustomerName(invoice) || '-'}
                </p>
              </div>
            )}
          </div>
        </div>

        {(invoice.projects || invoice.contracts) && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t('invoices.detail.projects_contracts')}</h3>
            <div className="grid grid-cols-2 gap-4">
              {invoice.projects && (
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.project')}</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.projects.name}</p>
                </div>
              )}
              {invoice.contracts && (
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.contract')}</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {invoice.contracts.contract_number}
                    {invoice.contracts.job_description && (
                      <span className="block text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {invoice.contracts.job_description}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {(invoice.reference_number || invoice.iban || invoice.refunds) && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t('invoices.detail.payment_details')}</h3>
            <div className="grid grid-cols-2 gap-4">
              {invoice.reference_number && (
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.reference')}</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.reference_number}</p>
                </div>
              )}
              {invoice.iban && (
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.iban')}</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.iban}</p>
                </div>
              )}
              {invoice.refunds && (
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.refund')}</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.refunds.name}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t('invoices.detail.financial')}</h3>
          <div className="space-y-3">
            {(invoice.base_amount_1 > 0 || invoice.base_amount_2 > 0 ||
              invoice.base_amount_3 > 0 || invoice.base_amount_4 > 0) ? (
              <div>
                <span className="text-sm text-gray-500 mb-2 block">{t('invoices.detail.base_by_vat')}</span>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded space-y-2">
                  {invoice.base_amount_1 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-200">25% PDV:</span>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t('invoices.detail.base_label')} &euro;{formatCurrency(invoice.base_amount_1)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">PDV: &euro;{formatCurrency(invoice.vat_amount_1 || invoice.base_amount_1 * 0.25)}</p>
                      </div>
                    </div>
                  )}
                  {invoice.base_amount_2 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-200">13% PDV:</span>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t('invoices.detail.base_label')} &euro;{formatCurrency(invoice.base_amount_2)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">PDV: &euro;{formatCurrency(invoice.vat_amount_2 || invoice.base_amount_2 * 0.13)}</p>
                      </div>
                    </div>
                  )}
                  {invoice.base_amount_4 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-200">5% PDV:</span>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t('invoices.detail.base_label')} &euro;{formatCurrency(invoice.base_amount_4)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">PDV: &euro;{formatCurrency(invoice.vat_amount_4 || invoice.base_amount_4 * 0.05)}</p>
                      </div>
                    </div>
                  )}
                  {invoice.base_amount_3 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-200">0% PDV:</span>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t('invoices.detail.base_label')} &euro;{formatCurrency(invoice.base_amount_3)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">PDV: &euro;0.00</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.base_label')}</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">&euro;{formatCurrency(invoice.base_amount)}</p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.detail.vat_total')}</span>
              <p className="text-sm font-medium text-gray-900 dark:text-white">&euro;{formatCurrency(invoice.vat_amount)}</p>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-base font-semibold text-gray-700 dark:text-gray-200">{t('invoices.detail.total')}</span>
              <p className="text-lg font-bold text-gray-900 dark:text-white">&euro;{formatCurrency(invoice.total_amount)}</p>
            </div>

            <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/20 p-2 rounded">
              <span className="text-sm text-green-700 dark:text-green-400">{t('invoices.detail.paid_amount')}</span>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">&euro;{formatCurrency(invoice.paid_amount)}</p>
            </div>

            {invoice.remaining_amount > 0 && (
              <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
                <span className="text-sm text-red-700 dark:text-red-400">{t('invoices.detail.remaining')}</span>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">&euro;{formatCurrency(invoice.remaining_amount)}</p>
              </div>
            )}
          </div>
        </div>

        {invoice.category && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t('invoices.detail.category')}</h3>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.category}</p>
          </div>
        )}

        {invoice.description && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t('invoices.detail.description')}</h3>
            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{invoice.description}</p>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer sticky>
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
