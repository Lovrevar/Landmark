import React from 'react'
import DateInput from '../../Common/DateInput'
import { Payment, Invoice, Company, CompanyBankAccount, CompanyCredit, PaymentFormData } from '../types/paymentTypes'
import { Modal, Button, Select, Input, Textarea, FormField } from '../../ui'

interface AccountingPaymentFormModalProps {
  showModal: boolean
  editingPayment: Payment | null
  formData: PaymentFormData
  setFormData: React.Dispatch<React.SetStateAction<PaymentFormData>>
  invoices: Invoice[]
  companies: Company[]
  companyBankAccounts: CompanyBankAccount[]
  companyCredits: CompanyCredit[]
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

const AccountingPaymentFormModal: React.FC<AccountingPaymentFormModalProps> = ({
  showModal,
  editingPayment,
  formData,
  setFormData,
  invoices,
  companies,
  companyBankAccounts,
  companyCredits,
  onClose,
  onSubmit
}) => {
  return (
    <Modal show={showModal} onClose={onClose}>
      <Modal.Header
        title={editingPayment ? 'Uredi plaćanje' : 'Novo plaćanje'}
        onClose={onClose}
      />

      <form onSubmit={onSubmit} className="overflow-y-auto flex-1 flex flex-col">
        <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Račun" required className="md:col-span-2">
              <Select
                value={formData.invoice_id}
                onChange={(e) => {
                  const selectedInvoice = invoices.find(inv => inv.id === e.target.value)
                  setFormData({
                    ...formData,
                    invoice_id: e.target.value,
                    company_bank_account_id: '',
                    amount: selectedInvoice ? selectedInvoice.remaining_amount : 0
                  })
                }}
                required
                disabled={!!editingPayment}
              >
                <option value="">Odaberi račun</option>
                {invoices.map(invoice => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} -
                    {invoice.invoice_type === 'EXPENSE'
                      ? ` ${invoice.subcontractors?.name}`
                      : invoice.customers ? ` ${invoice.customers.name} ${invoice.customers.surname}` : ''} -
                    Preostalo: €{invoice.remaining_amount.toLocaleString('hr-HR')}
                  </option>
                ))}
              </Select>
            </FormField>

            {formData.invoice_id && !formData.is_cesija && (
              <>
                <FormField label="Izvor plaćanja" required className="md:col-span-2">
                  <Select
                    value={formData.payment_source_type}
                    onChange={(e) => setFormData({
                      ...formData,
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

                {formData.payment_source_type === 'bank_account' && (
                  <FormField
                    label="Bankovni račun"
                    required
                    className="md:col-span-2"
                    error={
                      formData.invoice_id && companyBankAccounts.filter(acc => {
                        const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                        return selectedInvoice && acc.company_id === selectedInvoice.company_id
                      }).length === 0
                        ? 'Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.'
                        : undefined
                    }
                  >
                    <Select
                      value={formData.company_bank_account_id}
                      onChange={(e) => setFormData({ ...formData, company_bank_account_id: e.target.value })}
                      required
                    >
                      <option value="">Odaberi bankovni račun</option>
                      {companyBankAccounts
                        .filter(acc => {
                          const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                          return selectedInvoice && acc.company_id === selectedInvoice.company_id
                        })
                        .map(account => (
                          <option key={account.id} value={account.id}>
                            {account.bank_name} (Saldo: €{account.current_balance.toLocaleString('hr-HR')})
                          </option>
                        ))}
                    </Select>
                  </FormField>
                )}

                {formData.payment_source_type === 'credit' && (
                  <FormField
                    label="Kredit"
                    required
                    className="md:col-span-2"
                    error={
                      formData.invoice_id && companyCredits.filter(credit => {
                        const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                        return selectedInvoice && credit.company_id === selectedInvoice.company_id
                      }).length === 0
                        ? 'Ova firma nema dodanih kredita. Molimo dodajte kredit u sekciji Krediti.'
                        : undefined
                    }
                  >
                    <Select
                      value={formData.credit_id}
                      onChange={(e) => setFormData({ ...formData, credit_id: e.target.value })}
                      required
                    >
                      <option value="">Odaberi kredit</option>
                      {companyCredits
                        .filter(credit => {
                          const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                          return selectedInvoice && credit.company_id === selectedInvoice.company_id
                        })
                        .map(credit => {
                          const available = credit.amount - credit.used_amount
                          return (
                            <option key={credit.id} value={credit.id}>
                              {credit.credit_name} (Dostupno: €{available.toLocaleString('hr-HR')})
                            </option>
                          )
                        })}
                    </Select>
                  </FormField>
                )}
              </>
            )}

            {formData.invoice_id && (
              <div className="md:col-span-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_cesija}
                    onChange={(e) => setFormData({
                      ...formData,
                      is_cesija: e.target.checked,
                      company_bank_account_id: e.target.checked ? '' : formData.company_bank_account_id,
                      cesija_company_id: '',
                      cesija_bank_account_id: ''
                    })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Ugovor o cesiji (plaćanje iz druge firme)
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Označite ako želite platiti račun s bankovnog računa druge firme
                </p>
              </div>
            )}

            {formData.is_cesija && (
              <>
                <FormField label="Firma koja plaća (cesija)" required className="md:col-span-2">
                  <Select
                    value={formData.cesija_company_id}
                    onChange={(e) => setFormData({
                      ...formData,
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

                {formData.cesija_company_id && (
                  <FormField
                    label="Bankovni račun (cesija)"
                    required
                    className="md:col-span-2"
                    error={
                      formData.cesija_company_id && companyBankAccounts.filter(acc => acc.company_id === formData.cesija_company_id).length === 0
                        ? 'Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.'
                        : undefined
                    }
                  >
                    <Select
                      value={formData.cesija_bank_account_id}
                      onChange={(e) => setFormData({ ...formData, cesija_bank_account_id: e.target.value })}
                      required
                    >
                      <option value="">Odaberi bankovni račun</option>
                      {companyBankAccounts
                        .filter(acc => acc.company_id === formData.cesija_company_id)
                        .map(account => (
                          <option key={account.id} value={account.id}>
                            {account.bank_name} (Saldo: €{account.current_balance.toLocaleString('hr-HR')})
                          </option>
                        ))}
                    </Select>
                  </FormField>
                )}
              </>
            )}

            <FormField label="Datum plaćanja" required>
              <DateInput
                value={formData.payment_date}
                onChange={(value) => setFormData({ ...formData, payment_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </FormField>

            <FormField label="Iznos" required>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                required
              />
            </FormField>

            <FormField label="Način plaćanja" required>
              <Select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
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
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="Poziv na broj..."
              />
            </FormField>
          </div>

          <FormField label="Opis (opcionalno)">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Dodatne napomene..."
            />
          </FormField>
        </Modal.Body>
        <Modal.Footer sticky>
          <Button variant="secondary" type="button" onClick={onClose}>
            Odustani
          </Button>
          <Button variant="primary" type="submit">
            {editingPayment ? 'Spremi promjene' : 'Kreiraj plaćanje'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default AccountingPaymentFormModal
