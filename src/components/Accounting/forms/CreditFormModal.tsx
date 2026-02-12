import React, { useState, useEffect } from 'react'
import DateInput from '../../Common/DateInput'
import { Modal, Button, Input, Select, FormField } from '../../ui'
import type { Company, Project, Credit, CreditFormData, CompanyBankAccount } from '../types/creditTypes'
import { supabase } from '../../../lib/supabase'

interface CreditFormModalProps {
  showModal: boolean
  editingCredit: Credit | null
  formData: CreditFormData
  setFormData: (data: CreditFormData) => void
  companies: Company[]
  projects: Project[]
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

const CreditFormModal: React.FC<CreditFormModalProps> = ({
  showModal,
  editingCredit,
  formData,
  setFormData,
  companies,
  projects,
  onSubmit,
  onClose
}) => {
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  useEffect(() => {
    if (formData.company_id && formData.disbursed_to_account) {
      fetchCompanyBankAccounts(formData.company_id)
    } else {
      setCompanyBankAccounts([])
    }
  }, [formData.company_id, formData.disbursed_to_account])

  const fetchCompanyBankAccounts = async (companyId: string) => {
    try {
      setLoadingAccounts(true)
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select(`
          id,
          company_id,
          bank_name,
          account_number,
          current_balance
        `)
        .eq('company_id', companyId)

      if (error) throw error
      setCompanyBankAccounts(data || [])
    } catch (error) {
      console.error('Error fetching company bank accounts:', error)
      setCompanyBankAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }

  return (
    <Modal show={showModal} onClose={onClose} size="md">
      <Modal.Header
        title={editingCredit ? 'Edit Credit' : 'Add New Credit'}
        onClose={onClose}
      />

      <form onSubmit={onSubmit} className="overflow-y-auto flex-1">
        <div className="p-6 space-y-4">
          <FormField label="Company" required>
            <Select
              value={formData.company_id}
              onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              required
            >
              <option value="">Select Company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.oib})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Project (Optional)" helperText="Link credit to a specific project for tracking expenses">
            <Select
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
            >
              <option value="">No Project (General Credit)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Credit Name" required>
            <Input
              type="text"
              value={formData.credit_name}
              onChange={(e) => setFormData({ ...formData, credit_name: e.target.value })}
              placeholder="e.g., Bank Loan 2024"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" required>
              <DateInput
                value={formData.start_date}
                onChange={(value) => setFormData({ ...formData, start_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </FormField>

            <FormField label="End Date" required>
              <DateInput
                value={formData.end_date}
                onChange={(value) => setFormData({ ...formData, end_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Grace Period (months)" required>
              <Input
                type="number"
                value={formData.grace_period_months}
                onChange={(e) => setFormData({ ...formData, grace_period_months: parseInt(e.target.value) })}
                min="0"
                required
              />
            </FormField>

            <FormField label="Interest Rate (%)" required>
              <Input
                type="number"
                step="0.01"
                value={formData.interest_rate}
                onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) })}
                min="0"
                required
              />
            </FormField>
          </div>

          <FormField label="Credit Limit (€)" required>
            <Input
              type="number"
              step="0.01"
              value={formData.initial_amount}
              onChange={(e) => setFormData({ ...formData, initial_amount: parseFloat(e.target.value) })}
              min="0"
              required
            />
          </FormField>
        </div>

        <div className="px-6 pb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.disbursed_to_account || false}
                onChange={(e) => {
                  const checked = e.target.checked
                  setFormData({
                    ...formData,
                    disbursed_to_account: checked,
                    disbursed_to_bank_account_id: checked ? formData.disbursed_to_bank_account_id : undefined
                  })
                }}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">Isplata na račun</span>
                <p className="text-sm text-gray-600 mt-1">
                  Kada je označeno, ceo iznos kredita će automatski biti isplaćen na odabrani bankovni račun firme.
                </p>
              </div>
            </label>

            {formData.disbursed_to_account && (
              <div className="mt-4">
                {!formData.company_id ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">Molimo prvo odaberite firmu da biste videli dostupne bankovne račune.</p>
                  </div>
                ) : loadingAccounts ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600">Učitavanje računa...</p>
                  </div>
                ) : companyBankAccounts.length === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">Odabrana firma nema bankovnih računa. Molimo dodajte račun u "Moje firme" prvo.</p>
                  </div>
                ) : (
                  <FormField label="Bankovni račun" required>
                    <Select
                      value={formData.disbursed_to_bank_account_id || ''}
                      onChange={(e) => setFormData({ ...formData, disbursed_to_bank_account_id: e.target.value })}
                      required={formData.disbursed_to_account}
                    >
                      <option value="">Odaberite račun</option>
                      {companyBankAccounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name || 'Nepoznata banka'} {account.account_number ? `- ${account.account_number}` : ''} (Saldo: €{Number(account.current_balance).toLocaleString('hr-HR')})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
              </div>
            )}
          </div>
        </div>

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {editingCredit ? 'Update Credit' : 'Add Credit'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default CreditFormModal
