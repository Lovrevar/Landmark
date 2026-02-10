import React from 'react'
import { formatCurrency } from '../../Common/CurrencyInput'
import type { Company, CompanyBankAccount, CompanyCredit, CreditAllocation } from '../types/invoiceTypes'
import { Select, FormField } from '../../ui'

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
      <FormField label="Firma koja plaća (cesija)" required className="md:col-span-2">
        <Select
          value={paymentFormData.cesija_company_id}
          onChange={(e) => onFormChange({
            ...paymentFormData,
            cesija_company_id: e.target.value,
            cesija_bank_account_id: ''
          })}
          required
        >
          <option value="">Odaberi firmu koja plaća</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
      </FormField>

      {paymentFormData.cesija_company_id && (
        <>
          <FormField label="Izvor plaćanja (cesija)" required className="md:col-span-2">
            <Select
              value={paymentFormData.payment_source_type}
              onChange={(e) => onFormChange({
                ...paymentFormData,
                payment_source_type: e.target.value as 'bank_account' | 'credit',
                cesija_bank_account_id: '',
                cesija_credit_id: ''
              })}
              required
            >
              <option value="bank_account">Bankovni račun</option>
              <option value="credit">Kredit</option>
            </Select>
          </FormField>

          {paymentFormData.payment_source_type === 'bank_account' && (
            <FormField
              label="Bankovni račun (cesija)"
              required
              className="md:col-span-2"
              error={
                paymentFormData.cesija_company_id && companyBankAccounts.filter(acc => acc.company_id === paymentFormData.cesija_company_id).length === 0
                  ? 'Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.'
                  : undefined
              }
            >
              <Select
                value={paymentFormData.cesija_bank_account_id}
                onChange={(e) => onFormChange({ ...paymentFormData, cesija_bank_account_id: e.target.value })}
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
              </Select>
            </FormField>
          )}

          {paymentFormData.payment_source_type === 'credit' && (
            <FormField
              label="Kredit (cesija)"
              required
              className="md:col-span-2"
              error={
                paymentFormData.cesija_company_id && companyCredits.filter(credit =>
                  credit.company_id === paymentFormData.cesija_company_id &&
                  !credit.disbursed_to_account
                ).length === 0
                  ? 'Ova firma nema dostupnih kredita. Molimo dodajte kredit u sekciji Krediti.'
                  : undefined
              }
            >
              <Select
                value={paymentFormData.cesija_credit_id}
                onChange={(e) => {
                  const newCreditId = e.target.value
                  onFormChange({ ...paymentFormData, cesija_credit_id: newCreditId, cesija_credit_allocation_id: '' })
                  onCreditChange(newCreditId)
                }}
                required
              >
                <option value="">Odaberi kredit</option>
                {companyCredits
                  .filter(credit =>
                    credit.company_id === paymentFormData.cesija_company_id &&
                    !credit.disbursed_to_account
                  )
                  .map(credit => {
                    const available = credit.amount - credit.used_amount
                    return (
                      <option key={credit.id} value={credit.id}>
                        {credit.credit_name} (Dostupno: €{formatCurrency(available)})
                      </option>
                    )
                  })}
              </Select>
            </FormField>
          )}

          {paymentFormData.payment_source_type === 'credit' && paymentFormData.cesija_credit_id && (
            <FormField
              label="Projekt (cesija)"
              required
              className="md:col-span-2"
              error={
                creditAllocations.length === 0
                  ? 'Ovaj kredit nema alociranih projekata. Molimo definirajte namjenu kredita u Funding sekciji.'
                  : undefined
              }
            >
              <Select
                value={paymentFormData.cesija_credit_allocation_id}
                onChange={(e) => onFormChange({ ...paymentFormData, cesija_credit_allocation_id: e.target.value })}
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
              </Select>
            </FormField>
          )}
        </>
      )}
    </>
  )
}
