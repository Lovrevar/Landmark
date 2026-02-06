import React from 'react'
import { formatCurrency } from '../../Common/CurrencyInput'
import type { Company, CompanyBankAccount, CompanyCredit, CreditAllocation } from '../types/invoiceTypes'

interface CesijaPaymentFieldsProps {
  paymentFormData: any
  companies: Company[]
  companyBankAccounts: CompanyBankAccount[]
  companyCredits: CompanyCredit[]
  creditAllocations: CreditAllocation[]
  onFormChange: (data: any) => void
  onCreditChange: (creditId: string) => void
}

export const CesijaPaymentFields: React.FC<CesijaPaymentFieldsProps> = ({
  paymentFormData,
  companies,
  companyBankAccounts,
  companyCredits,
  creditAllocations,
  onFormChange,
  onCreditChange
}) => {
  if (!paymentFormData.is_cesija) return null

  return (
    <>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Firma koja plaća (cesija) *
        </label>
        <select
          value={paymentFormData.cesija_company_id}
          onChange={(e) => onFormChange({
            ...paymentFormData,
            cesija_company_id: e.target.value,
            cesija_bank_account_id: ''
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        >
          <option value="">Odaberi firmu koja plaća</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      {paymentFormData.cesija_company_id && (
        <>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Izvor plaćanja (cesija) *
            </label>
            <select
              value={paymentFormData.payment_source_type}
              onChange={(e) => onFormChange({
                ...paymentFormData,
                payment_source_type: e.target.value as 'bank_account' | 'credit',
                cesija_bank_account_id: '',
                cesija_credit_id: ''
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
                Bankovni račun (cesija) *
              </label>
              <select
                value={paymentFormData.cesija_bank_account_id}
                onChange={(e) => onFormChange({ ...paymentFormData, cesija_bank_account_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Odaberi bankovni račun</option>
                {companyBankAccounts
                  .filter(acc => acc.company_id === paymentFormData.cesija_company_id)
                  .map(account => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} (Saldo: €{formatCurrency(account.current_balance)})
                    </option>
                  ))}
              </select>
              {paymentFormData.cesija_company_id && companyBankAccounts.filter(acc => acc.company_id === paymentFormData.cesija_company_id).length === 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.
                </p>
              )}
            </div>
          )}

          {paymentFormData.payment_source_type === 'credit' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kredit (cesija) *
              </label>
              <select
                value={paymentFormData.cesija_credit_id}
                onChange={(e) => {
                  const newCreditId = e.target.value
                  onFormChange({ ...paymentFormData, cesija_credit_id: newCreditId, cesija_credit_allocation_id: '' })
                  onCreditChange(newCreditId)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Odaberi kredit</option>
                {companyCredits
                  .filter(credit => credit.company_id === paymentFormData.cesija_company_id)
                  .map(credit => {
                    const available = credit.amount - credit.used_amount
                    return (
                      <option key={credit.id} value={credit.id}>
                        {credit.credit_name} (Dostupno: €{formatCurrency(available)})
                      </option>
                    )
                  })}
              </select>
              {paymentFormData.cesija_company_id && companyCredits.filter(credit => credit.company_id === paymentFormData.cesija_company_id).length === 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Ova firma nema dodanih kredita. Molimo dodajte kredit u sekciji Krediti.
                </p>
              )}
            </div>
          )}

          {paymentFormData.payment_source_type === 'credit' && paymentFormData.cesija_credit_id && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Projekt (cesija) *
              </label>
              <select
                value={paymentFormData.cesija_credit_allocation_id}
                onChange={(e) => onFormChange({ ...paymentFormData, cesija_credit_allocation_id: e.target.value })}
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
    </>
  )
}
