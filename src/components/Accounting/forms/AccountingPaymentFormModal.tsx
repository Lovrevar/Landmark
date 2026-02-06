import React from 'react'
import { X } from 'lucide-react'
import DateInput from '../../Common/DateInput'
import { Payment, Invoice, Company, CompanyBankAccount, CompanyCredit, PaymentFormData } from '../types/paymentTypes'

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
  if (!showModal) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {editingPayment ? 'Uredi plaćanje' : 'Novo plaćanje'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Račun *
                </label>
                <select
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                </select>
              </div>

              {formData.invoice_id && !formData.is_cesija && (
                <>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Izvor plaćanja *
                    </label>
                    <select
                      value={formData.payment_source_type}
                      onChange={(e) => setFormData({
                        ...formData,
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

                  {formData.payment_source_type === 'bank_account' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bankovni račun *
                      </label>
                      <select
                        value={formData.company_bank_account_id}
                        onChange={(e) => setFormData({ ...formData, company_bank_account_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      </select>
                      {formData.invoice_id && companyBankAccounts.filter(acc => {
                        const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                        return selectedInvoice && acc.company_id === selectedInvoice.company_id
                      }).length === 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.
                        </p>
                      )}
                    </div>
                  )}

                  {formData.payment_source_type === 'credit' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kredit *
                      </label>
                      <select
                        value={formData.credit_id}
                        onChange={(e) => setFormData({ ...formData, credit_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      </select>
                      {formData.invoice_id && companyCredits.filter(credit => {
                        const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                        return selectedInvoice && credit.company_id === selectedInvoice.company_id
                      }).length === 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          Ova firma nema dodanih kredita. Molimo dodajte kredit u sekciji Krediti.
                        </p>
                      )}
                    </div>
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
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Firma koja plaća (cesija) *
                    </label>
                    <select
                      value={formData.cesija_company_id}
                      onChange={(e) => setFormData({
                        ...formData,
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

                  {formData.cesija_company_id && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bankovni račun (cesija) *
                      </label>
                      <select
                        value={formData.cesija_bank_account_id}
                        onChange={(e) => setFormData({ ...formData, cesija_bank_account_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      </select>
                      {formData.cesija_company_id && companyBankAccounts.filter(acc => acc.company_id === formData.cesija_company_id).length === 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Datum plaćanja *
                </label>
                <DateInput
                  value={formData.payment_date}
                  onChange={(value) => setFormData({ ...formData, payment_date: value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Iznos *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Način plaćanja *
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
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
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
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
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Dodatne napomene..."
              />
            </div>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              {editingPayment ? 'Spremi promjene' : 'Kreiraj plaćanje'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AccountingPaymentFormModal
