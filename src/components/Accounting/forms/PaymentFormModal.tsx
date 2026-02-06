import React from 'react'
import { X } from 'lucide-react'
import DateInput from '../../Common/DateInput'
import CurrencyInput, { formatCurrency } from '../../Common/CurrencyInput'
import { CesijaPaymentFields } from './CesijaPaymentFields'
import type { Invoice, Company, CompanyBankAccount, CompanyCredit, CreditAllocation } from '../types/invoiceTypes'

interface PaymentFormModalProps {
  show: boolean
  payingInvoice: Invoice | null
  paymentFormData: any
  companies: Company[]
  companyBankAccounts: CompanyBankAccount[]
  companyCredits: CompanyCredit[]
  creditAllocations: CreditAllocation[]
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onFormChange: (data: any) => void
  onCreditChange: (creditId: string) => void
}

export const PaymentFormModal: React.FC<PaymentFormModalProps> = ({
  show,
  payingInvoice,
  paymentFormData,
  companies,
  companyBankAccounts,
  companyCredits,
  creditAllocations,
  onClose,
  onSubmit,
  onFormChange,
  onCreditChange
}) => {
  if (!show || !payingInvoice) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            Plati račun: {payingInvoice.invoice_number}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Ukupan iznos:</span>
              <span className="font-medium">€{formatCurrency(payingInvoice.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Plaćeno:</span>
              <span className="font-medium text-green-600">€{formatCurrency(payingInvoice.paid_amount)}</span>
            </div>
            <div className="flex justify-between text-base border-t border-gray-300 pt-2">
              <span className="font-semibold text-gray-900">Preostalo za plaćanje:</span>
              <span className="font-bold text-red-600">€{formatCurrency(payingInvoice.remaining_amount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!paymentFormData.is_cesija && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Izvor plaćanja *
                  </label>
                  <select
                    value={paymentFormData.payment_source_type}
                    onChange={(e) => onFormChange({
                      ...paymentFormData,
                      payment_source_type: e.target.value as 'bank_account' | 'credit',
                      company_bank_account_id: '',
                      credit_id: ''
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="bank_account">Bankovni račun</option>
                    <option value="credit">Kredit</option>
                  </select>
                </div>

                {paymentFormData.payment_source_type === 'bank_account' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bankovni račun *
                    </label>
                    <select
                      value={paymentFormData.company_bank_account_id}
                      onChange={(e) => onFormChange({ ...paymentFormData, company_bank_account_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberi bankovni račun</option>
                      {companyBankAccounts
                        .filter(acc => acc.company_id === payingInvoice.company_id)
                        .map(account => (
                          <option key={account.id} value={account.id}>
                            {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} (Saldo: €{formatCurrency(account.current_balance)})
                          </option>
                        ))}
                    </select>
                    {companyBankAccounts.filter(acc => acc.company_id === payingInvoice.company_id).length === 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.
                      </p>
                    )}
                  </div>
                )}

                {paymentFormData.payment_source_type === 'credit' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kredit *
                    </label>
                    <select
                      value={paymentFormData.credit_id}
                      onChange={(e) => {
                        const newCreditId = e.target.value
                        onFormChange({ ...paymentFormData, credit_id: newCreditId, credit_allocation_id: '' })
                        onCreditChange(newCreditId)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberi kredit</option>
                      {companyCredits
                        .filter(credit => credit.company_id === payingInvoice.company_id)
                        .map(credit => {
                          const available = credit.amount - credit.used_amount
                          return (
                            <option key={credit.id} value={credit.id}>
                              {credit.credit_name} (Dostupno: €{formatCurrency(available)})
                            </option>
                          )
                        })}
                    </select>
                    {companyCredits.filter(credit => credit.company_id === payingInvoice.company_id).length === 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Ova firma nema dodanih kredita. Molimo dodajte kredit u sekciji Krediti.
                      </p>
                    )}
                  </div>
                )}

                {paymentFormData.payment_source_type === 'credit' && paymentFormData.credit_id && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Projekt *
                    </label>
                    <select
                      value={paymentFormData.credit_allocation_id}
                      onChange={(e) => onFormChange({ ...paymentFormData, credit_allocation_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberi projekt</option>
                      {creditAllocations.map(allocation => {
                        const available = allocation.allocated_amount - allocation.used_amount
                        return (
                          <option key={allocation.id} value={allocation.id}>
                            {allocation.project?.name || 'OPEX (Bez projekta)'} (Dostupno: €{formatCurrency(available)})
                          </option>
                        )
                      })}
                    </select>
                    {creditAllocations.length === 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Ovaj kredit nema alociranih projekata. Molimo definirajte namjenu kredita u Funding sekciji.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="md:col-span-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentFormData.is_cesija}
                  onChange={(e) => onFormChange({
                    ...paymentFormData,
                    is_cesija: e.target.checked,
                    company_bank_account_id: e.target.checked ? '' : paymentFormData.company_bank_account_id,
                    cesija_company_id: '',
                    cesija_bank_account_id: ''
                  })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Ugovor o cesiji (plaćanje iz bankovnog računa druge firme)
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Označite ako želite platiti račun s bankovnog računa druge firme
              </p>
            </div>

            <CesijaPaymentFields
              paymentFormData={paymentFormData}
              companies={companies}
              companyBankAccounts={companyBankAccounts}
              companyCredits={companyCredits}
              creditAllocations={creditAllocations}
              onFormChange={onFormChange}
              onCreditChange={onCreditChange}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum plaćanja *
              </label>
              <DateInput
                value={paymentFormData.payment_date}
                onChange={(value) => onFormChange({ ...paymentFormData, payment_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Iznos plaćanja *
              </label>
              <CurrencyInput
                value={paymentFormData.amount}
                onChange={(value) => onFormChange({ ...paymentFormData, amount: value })}
                placeholder="0,00"
                min={0.01}
              />
              <p className="text-xs text-gray-500 mt-1">
                Max iznos: €{formatCurrency(payingInvoice.remaining_amount)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Način plaćanja *
              </label>
              <select
                value={paymentFormData.payment_method}
                onChange={(e) => onFormChange({ ...paymentFormData, payment_method: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="WIRE">Virman</option>
                <option value="CASH">Gotovina</option>
                <option value="CHECK">Ček</option>
                <option value="CARD">Kartica</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referenca (opcionalno)
              </label>
              <input
                type="text"
                value={paymentFormData.reference_number}
                onChange={(e) => onFormChange({ ...paymentFormData, reference_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Poziv na broj..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opis (opcionalno)
            </label>
            <textarea
              value={paymentFormData.description}
              onChange={(e) => onFormChange({ ...paymentFormData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Dodatne napomene..."
            />
          </div>

          {paymentFormData.amount > 0 && paymentFormData.amount <= payingInvoice.remaining_amount && (
            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <p className="text-sm text-blue-800 font-medium">
                {paymentFormData.amount === payingInvoice.remaining_amount
                  ? 'Račun će biti označen kao PLAĆEN'
                  : `Preostalo nakon plaćanja: €${formatCurrency(payingInvoice.remaining_amount - paymentFormData.amount)}`}
              </p>
              {paymentFormData.amount < payingInvoice.remaining_amount && (
                <p className="text-xs text-blue-700">
                  Status će biti promijenjen na DJELOMIČNO PLAĆENO
                </p>
              )}
            </div>
          )}

          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Odustani
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Potvrdi plaćanje
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
