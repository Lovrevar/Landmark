import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Calendar, DollarSign, Building2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { Subcontractor } from '../../../../lib/supabase'
import { Modal, Button, Badge, LoadingSpinner, EmptyState } from '../../../ui'
import { fetchContractInvoices, ContractInvoiceRow } from '../services/siteService'

type Invoice = ContractInvoiceRow

type SubcontractorWithContractInfo = Subcontractor & {
  contract_id?: string
  company_name?: string
  contract_title?: string
  contract_number?: string
}

interface InvoicesModalProps {
  isOpen: boolean
  onClose: () => void
  subcontractor: Subcontractor
}

export const InvoicesModal: React.FC<InvoicesModalProps> = ({
  isOpen,
  onClose,
  subcontractor
}) => {
  const { t } = useTranslation()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && subcontractor) {
      fetchInvoices()
    }
  }, [isOpen, subcontractor?.id])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const fetchInvoices = async () => {
    if (!subcontractor) return

    const contractId = (subcontractor as SubcontractorWithContractInfo).contract_id || subcontractor.id

    /*console.log('🔍 InvoicesModal - Fetching invoices for CONTRACT:', {
      contract_id: contractId,
      subcontractor_name: (subcontractor as any).company_name || subcontractor.name,
      contract_title: (subcontractor as any).contract_title,
      full_subcontractor_object: subcontractor
    })*/

    setLoading(true)
    try {
      const formattedInvoices = await fetchContractInvoices(contractId)
      setInvoices(formattedInvoices)
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusVariant = (status: string): 'green' | 'yellow' | 'red' | 'gray' => {
    switch (status) {
      case 'PAID':
        return 'green'
      case 'PARTIALLY_PAID':
        return 'yellow'
      case 'UNPAID':
        return 'red'
      default:
        return 'gray'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PAID':
        return t('common.paid')
      case 'PARTIALLY_PAID':
        return t('common.partial')
      case 'UNPAID':
        return t('common.unpaid')
      default:
        return status
    }
  }

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'PAID') return false
    return new Date(dueDate) < new Date()
  }

  if (!isOpen || !subcontractor) return null

  return (
    <Modal show={true} onClose={onClose} size="full">
      <Modal.Header
        title={`${t('supervision.invoices_modal.title')} ${(subcontractor as SubcontractorWithContractInfo).company_name || subcontractor.name}`}
        subtitle={`${t('supervision.invoices_modal.contract')} ${(subcontractor as SubcontractorWithContractInfo).contract_title || (subcontractor as SubcontractorWithContractInfo).contract_number || 'N/A'}`}
        onClose={onClose}
      />

      <Modal.Body>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t('supervision.invoices_modal.no_invoices')}
            description={t('supervision.invoices_modal.no_invoices_desc')}
          />
        ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className={`bg-white dark:bg-gray-800 border-2 rounded-lg p-6 hover:shadow-md transition-shadow ${
                    isOverdue(invoice.due_date, invoice.status) ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('supervision.invoices_modal.invoice_number')}</label>
                        <Badge variant={getStatusVariant(invoice.status)} size="sm">
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{invoice.invoice_number}</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2 block">{t('supervision.invoices_modal.company')}</label>
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.company_name}</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2 block">{t('supervision.invoices_modal.total_amount')}</label>
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-1" />
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          €{invoice.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {invoice.status !== 'UNPAID' && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {t('supervision.invoices_modal.paid')} €{invoice.paid_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2 block">{t('supervision.invoices_modal.due_date')}</label>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                        <p className={`text-sm font-medium ${
                          isOverdue(invoice.due_date, invoice.status) ? 'text-red-600 font-bold' : 'text-gray-900 dark:text-white'
                        }`}>
                          {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                        </p>
                      </div>
                      {isOverdue(invoice.due_date, invoice.status) && (
                        <div className="flex items-center mt-1 text-red-600">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          <span className="text-xs font-semibold">{t('supervision.invoices_modal.overdue')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {invoice.description && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase block mb-1">{t('supervision.invoices_modal.description')}</label>
                      <p className="text-sm text-gray-700 dark:text-gray-200">{invoice.description}</p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">{t('supervision.invoices_modal.base_amount')}</span>
                      <span className="ml-2 font-medium">€{invoice.base_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">{t('supervision.invoices_modal.vat')}</span>
                      <span className="ml-2 font-medium">€{invoice.vat_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">{t('supervision.invoices_modal.issue_date')}</span>
                      <span className="ml-2 font-medium">{format(new Date(invoice.issue_date), 'dd.MM.yyyy')}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {t('supervision.invoices_modal.total_invoices')} <span className="font-semibold">{invoices.length}</span>
        </div>
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
