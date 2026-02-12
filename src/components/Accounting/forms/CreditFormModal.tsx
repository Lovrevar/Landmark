import React from 'react'
import DateInput from '../../Common/DateInput'
import { Modal, Button, Input, Select, FormField } from '../../ui'
import type { Company, Project, Credit, CreditFormData } from '../types/creditTypes'

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

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {editingCredit ? 'Update Loan' : 'Add Loan'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default CreditFormModal
