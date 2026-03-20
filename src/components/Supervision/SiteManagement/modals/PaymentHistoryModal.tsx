import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, FileText, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { Subcontractor, WirePayment } from '../../../../lib/supabase'
import { fetchContractInvoiceTotals } from '../services/siteService'
import { Modal, Button, Badge, EmptyState } from '../../../ui'

interface AccountingPayment {
  id: string
  amount: number
  payment_date: string | null
  payment_method: string | null
  reference_number: string | null
  description: string | null
  created_at: string
  invoice?: {
    id: string
    invoice_number: string
    invoice_type: string
    total_amount: number
    status: string
  }
}

interface PaymentHistoryModalProps {
  visible: boolean
  onClose: () => void
  subcontractor: Subcontractor | null
  payments: (WirePayment | AccountingPayment)[]
  onEditPayment: (payment: WirePayment) => void
  onDeletePayment: (paymentId: string, amount: number) => void
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  visible,
  onClose,
  subcontractor,
  payments,
  onEditPayment,
  onDeletePayment
}) => {
  const { t } = useTranslation()
  const [totalInvoiceAmount, setTotalInvoiceAmount] = useState<number>(0)
  const [totalPaidAmount, setTotalPaidAmount] = useState<number>(0)
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    if (visible && subcontractor) {
      fetchInvoiceTotals()
    }
  }, [visible, subcontractor])

  const fetchInvoiceTotals = async () => {
    if (!subcontractor) return

    const contractId = (subcontractor as Subcontractor & { contract_id?: string }).contract_id || subcontractor.id

    setLoading(true)
    try {
      const { totalInvoiceAmount, totalPaidAmount } = await fetchContractInvoiceTotals(contractId)
      setTotalInvoiceAmount(totalInvoiceAmount)
      setTotalPaidAmount(totalPaidAmount)
    } catch (error) {
      console.error('Error fetching invoice totals:', error)
      setTotalInvoiceAmount(0)
      setTotalPaidAmount(0)
    } finally {
      setLoading(false)
    }
  }

  const getStatusVariant = (status: string): 'green' | 'yellow' => {
    return status === 'paid' ? 'green' : 'yellow'
  }

  if (!visible || !subcontractor) return null

  return (
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header
        title={t('supervision.payment_history.title')}
        subtitle={subcontractor.name}
        onClose={onClose}
      />

      <Modal.Body>
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">{t('supervision.payment_history.total_invoices')}</p>
                <p className="text-lg font-bold text-gray-900">
                  €{loading ? '...' : totalInvoiceAmount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('supervision.payment_history.total_paid')}</p>
                <p className="text-lg font-bold text-teal-600">
                  €{loading ? '...' : totalPaidAmount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('supervision.payment_history.remaining')}</p>
                <p className="text-lg font-bold text-orange-600">
                  €{loading ? '...' : Math.max(0, totalInvoiceAmount - totalPaidAmount).toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

        <h4 className="font-semibold text-gray-900 mb-3">{t('supervision.payment_history.all_payments')} ({payments.length})</h4>

        {payments.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title={t('supervision.payment_history.no_payments')}
          />
        ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const isAccountingPayment = 'invoice' in payment
                const accountingPayment = payment as AccountingPayment

                return (
                  <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg font-bold text-gray-900">€{payment.amount.toLocaleString('hr-HR')}</span>
                          {payment.payment_date && (
                            <span className="text-sm text-gray-600">
                              {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                            </span>
                          )}
                          {!payment.payment_date && (
                            <span className="text-sm text-gray-400 italic">{t('supervision.edit_payment.date_not_set')}</span>
                          )}
                        </div>

                        {isAccountingPayment && accountingPayment.invoice && (
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-gray-700">
                              {t('supervision.payment_history.invoice')} <span className="font-medium text-blue-600">
                                {accountingPayment.invoice.invoice_number}
                              </span>
                            </span>
                            <Badge variant={getStatusVariant(accountingPayment.invoice.status)} size="sm">
                              {accountingPayment.invoice.status}
                            </Badge>
                          </div>
                        )}

                        {isAccountingPayment && accountingPayment.payment_method && (
                          <div className="text-sm text-gray-600 mb-2">
                            {t('supervision.payment_history.method')} <span className="font-medium">{accountingPayment.payment_method}</span>
                          </div>
                        )}

                        {isAccountingPayment && accountingPayment.reference_number && (
                          <div className="text-sm text-gray-600 mb-2">
                            {t('supervision.payment_history.ref')} {accountingPayment.reference_number}
                          </div>
                        )}

                        {!isAccountingPayment && (payment as WirePayment).paid_by_bank_id && (
                          <div className="flex items-center space-x-2 mb-2">
                            <Building2 className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-gray-700">
                              {t('supervision.payment_history.paid_by')} <span className="font-medium text-green-600">
                                {(payment as WirePayment & { bank?: { name: string } }).bank?.name || t('common.bank')}
                              </span>
                            </span>
                          </div>
                        )}

                        {((isAccountingPayment && accountingPayment.description) || (!isAccountingPayment && (payment as WirePayment).notes)) && (
                          <p className="text-sm text-gray-600 mb-2">
                            {isAccountingPayment ? accountingPayment.description : (payment as WirePayment).notes}
                          </p>
                        )}

                        <p className="text-xs text-gray-400">
                          {t('supervision.payment_history.created')} {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      {!isAccountingPayment && (
                        <div className="flex space-x-2 ml-4">
                          <Button size="sm" onClick={() => onEditPayment(payment as WirePayment)}>
                            {t('common.edit')}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => onDeletePayment(payment.id, payment.amount)}>
                            {t('common.delete')}
                          </Button>
                        </div>
                      )}
                      {isAccountingPayment && (
                        <div className="ml-4">
                          <span className="text-xs text-gray-500 italic">{t('supervision.payment_history.managed_in_accounting')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
