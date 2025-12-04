import React, { useEffect, useState } from 'react'
import { X, FileText, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../../../../lib/supabase'
import type { RetailContract } from '../../../../types/retail'

interface AccountingPayment {
  id: string
  amount: number
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
      console.log('=== RETAIL PAYMENTS DEBUG ===')
      console.log('Contract ID:', contract.id)
      console.log('Contract Number:', contract.contract_number)

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('accounting_invoices')
        .select('id, invoice_number, invoice_category, retail_contract_id')
        .eq('retail_contract_id', contract.id)

      console.log('Invoices Query Result:', { invoicesData, invoicesError })

      if (invoicesError) {
        console.error('Invoices Error:', invoicesError)
        throw invoicesError
      }

      const invoiceIds = (invoicesData || []).map(inv => inv.id)
      console.log('Invoice IDs:', invoiceIds)

      if (invoiceIds.length === 0) {
        console.log('No invoices found for this contract')
        setPayments([])
        return
      }

      const { data, error } = await supabase
        .from('accounting_payments')
        .select(`
          id,
          amount,
          payment_date,
          payment_method,
          reference_number,
          description,
          is_cesija,
          created_at,
          invoice_id,
          company_bank_account_id,
          cesija_credit_id,
          accounting_invoices(
            id,
            invoice_number,
            invoice_type,
            total_amount,
            status
          ),
          company_bank_account:company_bank_accounts!accounting_payments_company_bank_account_id_fkey(
            bank_name,
            account_number
          ),
          company_credits(
            credit_name
          )
        `)
        .in('invoice_id', invoiceIds)
        .order('payment_date', { ascending: false })

      console.log('Payments Query Result:', { data, error })

      if (error) {
        console.error('Payments Error:', error)
        throw error
      }

      const formattedPayments = (data || []).map((payment: any) => ({
        id: payment.id,
        amount: parseFloat(payment.amount),
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        reference_number: payment.reference_number,
        description: payment.description,
        is_cesija: payment.is_cesija,
        created_at: payment.created_at,
        invoice: payment.accounting_invoices,
        company_bank_account: payment.company_bank_account,
        credit: payment.company_credits
      }))

      console.log('Formatted Payments:', formattedPayments)
      console.log('=== END DEBUG ===')

      setPayments(formattedPayments)
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!visible || !contract) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Povijest plaćanja</h3>
              <p className="text-sm text-gray-600 mt-1">{contract.contract_number}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Iznos ugovora</p>
                <p className="text-lg font-bold text-gray-900">€{contract.contract_amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Ukupno plaćeno</p>
                <p className="text-lg font-bold text-teal-600">€{contract.budget_realized.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Preostalo</p>
                <p className="text-lg font-bold text-orange-600">
                  €{Math.max(0, contract.contract_amount - contract.budget_realized).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <h4 className="font-semibold text-gray-900 mb-3">Sva plaćanja ({payments.length})</h4>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Učitavanje...</p>
            </div>
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
                        <span className="text-lg font-bold text-gray-900">€{payment.amount.toLocaleString()}</span>
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
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            payment.invoice.status === 'PAID'
                              ? 'bg-green-100 text-green-800'
                              : payment.invoice.status === 'PARTIALLY_PAID'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {payment.invoice.status === 'PAID' ? 'Plaćeno' :
                             payment.invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                          </span>
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
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  )
}
