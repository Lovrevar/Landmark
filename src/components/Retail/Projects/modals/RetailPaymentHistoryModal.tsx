import React, { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { format } from 'date-fns'
import { Button, Badge, Modal, LoadingSpinner } from '../../../ui'
import type { RetailContract } from '../../../../types/retail'
import { retailProjectService } from '../Services/retailProjectService'

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
        title="Povijest plaćanja"
        subtitle={contract.contract_number}
        onClose={onClose}
      />
      <Modal.Body>
        <p className="text-xs text-blue-600 mb-4">* Svi iznosi prikazani bez PDV-a</p>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Iznos ugovora</p>
              <p className="text-lg font-bold text-gray-900">€{contract.contract_amount.toLocaleString('hr-HR')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Ukupno plaćeno</p>
              <p className="text-lg font-bold text-teal-600">€{contract.budget_realized.toLocaleString('hr-HR')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Preostalo</p>
              <p className="text-lg font-bold text-orange-600">
                €{Math.max(0, contract.contract_amount - contract.budget_realized).toLocaleString('hr-HR')}
              </p>
            </div>
          </div>
        </div>

        <h4 className="font-semibold text-gray-900 mb-3">Sva plaćanja ({payments.length})</h4>

        {loading ? (
          <LoadingSpinner message="Učitavanje..." />
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nema zabilježenih plaćanja
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-teal-700">
                          €{payment.base_amount_paid.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-gray-500">
                          (sa PDV: €{payment.amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </span>
                      </div>
                      {payment.payment_date && (
                        <span className="text-sm text-gray-600">
                          {format(new Date(payment.payment_date), 'dd.MM.yyyy')}
                        </span>
                      )}
                      {!payment.payment_date && (
                        <span className="text-sm text-gray-400 italic">Datum nije postavljen</span>
                      )}
                    </div>

                    {payment.invoice && (
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-gray-700">
                          Račun: <span className="font-medium text-blue-600">
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
                          {payment.invoice.status === 'PAID' ? 'Plaćeno' :
                           payment.invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                        </Badge>
                      </div>
                    )}

                    {payment.payment_method && (
                      <div className="text-sm text-gray-600 mb-2">
                        Način plaćanja: <span className="font-medium">{payment.payment_method}</span>
                      </div>
                    )}

                    {payment.is_cesija && (
                      <div className="text-sm text-blue-600 mb-2 font-medium">
                        Cesija
                      </div>
                    )}

                    {payment.company_bank_account && (
                      <div className="text-sm text-gray-600 mb-2">
                        Račun: {payment.company_bank_account.bank_name}
                        {payment.company_bank_account.account_number && ` - ${payment.company_bank_account.account_number}`}
                      </div>
                    )}

                    {payment.credit && (
                      <div className="text-sm text-gray-600 mb-2">
                        Kredit: {payment.credit.credit_name}
                      </div>
                    )}

                    {payment.reference_number && (
                      <div className="text-sm text-gray-600 mb-2">
                        Referenca: {payment.reference_number}
                      </div>
                    )}

                    {payment.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {payment.description}
                      </p>
                    )}

                    <p className="text-xs text-gray-400">
                      Kreirano {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="ml-4">
                    <span className="text-xs text-gray-500 italic">Upravljano u Računovodstvu</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>
          Zatvori
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
