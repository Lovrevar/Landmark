import React, { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Button, Badge, Modal, LoadingSpinner } from '../../../ui'
import type { RetailContract } from '../../../../types/retail'
import { retailProjectService } from '../services/retailProjectService'

interface AccountingPayment {
  id: string
  amount: number
  base_amount_paid: number
  payment_date: string | null
  payment_method: string | null
  reference_number: string | null
  description: string | null
  created_at: string
  is_cesija: boolean
  invoice?: {
    id: string
    invoice_number: string
    invoice_type: string
    base_amount: number
    total_amount: number
    status: string
  }
  company_bank_account?: {
    bank_name: string
    account_number: string
  }
  credit?: {
    credit_name: string
  }
}

interface RetailPaymentHistoryModalProps {
  visible: boolean
  onClose: () => void
  contract: RetailContract | null
}

export const RetailPaymentHistoryModal: React.FC<RetailPaymentHistoryModalProps> = ({
  visible,
  onClose,
  contract
}) => {
  const { t } = useTranslation()
  const [payments, setPayments] = useState<AccountingPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (visible && contract) {
      fetchPayments()
    }
  }, [visible, contract?.id])

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [visible])

  const fetchPayments = async () => {
    if (!contract) return

    setLoading(true)
    try {
      const formattedPayments = await retailProjectService.fetchRetailContractPayments(contract.id)
      setPayments(formattedPayments)
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!visible || !contract) return null

  return (
    <Modal show={visible && !!contract} onClose={onClose} size="lg">
      <Modal.Header
        title={t('retail_projects.payment_history_modal.title')}
        subtitle={contract.contract_number}
        onClose={onClose}
      />
      <Modal.Body>
        <p className="text-xs text-blue-600 mb-4">{t('retail_projects.payment_history_modal.amounts_note')}</p>

        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('retail_projects.payment_history_modal.contract_amount')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">€{contract.contract_amount.toLocaleString('hr-HR')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('retail_projects.payment_history_modal.total_paid')}</p>
              <p className="text-lg font-bold text-teal-600">€{contract.budget_realized.toLocaleString('hr-HR')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('retail_projects.payment_history_modal.remaining')}</p>
              <p className="text-lg font-bold text-orange-600">
                €{Math.max(0, contract.contract_amount - contract.budget_realized).toLocaleString('hr-HR')}
              </p>
            </div>
          </div>
        </div>

        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('retail_projects.payment_history_modal.all_payments', { count: payments.length })}</h4>

        {loading ? (
          <LoadingSpinner message={t('common.loading')} />
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('retail_projects.payment_history_modal.no_payments')}
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-teal-700">
                          €{payment.base_amount_paid.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {t('retail_projects.payment_history_modal.with_vat', { amount: payment.amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
                        </span>
                      </div>
                      {payment.payment_date && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {format(new Date(payment.payment_date), 'dd.MM.yyyy')}
                        </span>
                      )}
                      {!payment.payment_date && (
                        <span className="text-sm text-gray-400 dark:text-gray-500 italic">{t('retail_projects.payment_history_modal.no_date')}</span>
                      )}
                    </div>

                    {payment.invoice && (
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-gray-700 dark:text-gray-200">
                          {t('retail_projects.payment_history_modal.invoice_label')} <span className="font-medium text-blue-600">
                            {payment.invoice.invoice_number}
                          </span>
                        </span>
                        <Badge variant={
                          payment.invoice.status === 'PAID'
                            ? 'green'
                            : payment.invoice.status === 'PARTIALLY_PAID'
                            ? 'yellow'
                            : 'red'
                        } size="sm">
                          {payment.invoice.status === 'PAID' ? t('retail_projects.payment_history_modal.status_paid') :
                           payment.invoice.status === 'PARTIALLY_PAID' ? t('retail_projects.payment_history_modal.status_partial') : t('retail_projects.payment_history_modal.status_unpaid')}
                        </Badge>
                      </div>
                    )}

                    {payment.payment_method && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {t('retail_projects.payment_history_modal.payment_method_label')} <span className="font-medium">{payment.payment_method}</span>
                      </div>
                    )}

                    {payment.is_cesija && (
                      <div className="text-sm text-blue-600 mb-2 font-medium">
                        {t('retail_projects.payment_history_modal.cesija_label')}
                      </div>
                    )}

                    {payment.company_bank_account && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {t('retail_projects.payment_history_modal.account_label')} {payment.company_bank_account.bank_name}
                        {payment.company_bank_account.account_number && ` - ${payment.company_bank_account.account_number}`}
                      </div>
                    )}

                    {payment.credit && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {t('retail_projects.payment_history_modal.credit_label')} {payment.credit.credit_name}
                      </div>
                    )}

                    {payment.reference_number && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {t('retail_projects.payment_history_modal.reference_label')} {payment.reference_number}
                      </div>
                    )}

                    {payment.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {payment.description}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {t('retail_projects.payment_history_modal.created_label')} {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="ml-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400 italic">{t('retail_projects.payment_history_modal.managed_in_accounting')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>
          {t('common.close')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
