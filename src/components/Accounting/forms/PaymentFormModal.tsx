import React from 'react'
import DateInput from '../../Common/DateInput'
import CurrencyInput, { formatCurrency } from '../../Common/CurrencyInput'
import { CesijaPaymentFields } from './CesijaPaymentFields'
import { Modal, Button, Input, Select, Textarea, FormField } from '../../ui'
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
    <Modal show={show} onClose={onClose} size="sm">
      <Modal.Header
        title={`Plati račun: ${payingInvoice.invoice_number}`}
        onClose={onClose}
      />

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
                <FormField label="Izvor plaćanja" required className="md:col-span-2">
                  <Select
                    value={paymentFormData.payment_source_type}
                    onChange={(e) => onFormChange({
                      ...paymentFormData,
                      payment_source_type: e.target.value as 'bank_account' | 'credit',
                      company_bank_account_id: '',
                      credit_id: ''
                    })}
                    required
                  >
                    <option value="bank_account">Bankovni račun</option>
                    <option value="credit">Kredit</option>
                  </Select>
                </FormField>

                {paymentFormData.payment_source_type === 'bank_account' && (
                  <FormField
                    label="Bankovni račun"
                    required
                    className="md:col-span-2"
                    error={companyBankAccounts.filter(acc => acc.company_id === payingInvoice.company_id).length === 0
                      ? 'Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.'
                      : undefined}
                  >
                    <Select
                      value={paymentFormData.company_bank_account_id}
                      onChange={(e) => onFormChange({ ...paymentFormData, company_bank_account_id: e.target.value })}
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
                    </Select>
                  </FormField>
                )}

                {paymentFormData.payment_source_type === 'credit' && (
                  <FormField
                    label="Kredit"
                    required
                    className="md:col-span-2"
                    error={companyCredits.filter(credit => credit.company_id === payingInvoice.company_id).length === 0
                      ? 'Ova firma nema dodanih kredita. Molimo dodajte kredit u sekciji Krediti.'
                      : undefined}
                  >
                    <Select
                      value={paymentFormData.credit_id}
                      onChange={(e) => {
                        const newCreditId = e.target.value
                        onFormChange({ ...paymentFormData, credit_id: newCreditId, credit_allocation_id: '' })
                        onCreditChange(newCreditId)
                      }}
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
                    </Select>
                  </FormField>
                )}

                {paymentFormData.payment_source_type === 'credit' && paymentFormData.credit_id && (
                  <FormField
                    label="Projekt"
                    required
                    className="md:col-span-2"
                    error={creditAllocations.length === 0
                      ? 'Ovaj kredit nema alociranih projekata. Molimo definirajte namjenu kredita u Funding sekciji.'
                      : undefined}
                  >
                    <Select
                      value={paymentFormData.credit_allocation_id}
                      onChange={(e) => onFormChange({ ...paymentFormData, credit_allocation_id: e.target.value })}
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

            <FormField label="Datum plaćanja" required>
              <DateInput
                value={paymentFormData.payment_date}
                onChange={(value) => onFormChange({ ...paymentFormData, payment_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </FormField>

            <FormField label="Iznos plaćanja" required helperText={`Max iznos: €${formatCurrency(payingInvoice.remaining_amount)}`}>
              <CurrencyInput
                value={paymentFormData.amount}
                onChange={(value) => onFormChange({ ...paymentFormData, amount: value })}
                placeholder="0,00"
                min={0.01}
              />
            </FormField>

            <FormField label="Način plaćanja" required>
              <Select
                value={paymentFormData.payment_method}
                onChange={(e) => onFormChange({ ...paymentFormData, payment_method: e.target.value as any })}
                required
              >
                <option value="WIRE">Virman</option>
                <option value="CASH">Gotovina</option>
                <option value="CHECK">Ček</option>
                <option value="CARD">Kartica</option>
              </Select>
            </FormField>

            <FormField label="Referenca (opcionalno)">
              <Input
                type="text"
                value={paymentFormData.reference_number}
                onChange={(e) => onFormChange({ ...paymentFormData, reference_number: e.target.value })}
                placeholder="Poziv na broj..."
              />
            </FormField>
          </div>

          <FormField label="Opis (opcionalno)">
            <Textarea
              value={paymentFormData.description}
              onChange={(e) => onFormChange({ ...paymentFormData, description: e.target.value })}
              rows={3}
              placeholder="Dodatne napomene..."
            />
          </FormField>

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

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            Odustani
          </Button>
          <Button variant="success" type="submit">
            Potvrdi plaćanje
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
