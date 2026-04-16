import React from 'react'
import { useTranslation } from 'react-i18next'
import { FormField, Select, Input, Alert } from '../../../ui'
import DateInput from '../../../Common/DateInput'
import CurrencyInput from '../../../Common/CurrencyInput'
import {
  Company,
  RetailSupplier,
  RetailCustomer,
  RetailProject,
  RetailContract,
  RetailMilestone,
  InvoiceCategory,
  Refund,
  RetailInvoiceFormData
} from '../retailInvoiceTypes'

interface RetailInvoiceFormFieldsProps {
  formData: RetailInvoiceFormData
  setFormData: React.Dispatch<React.SetStateAction<RetailInvoiceFormData>>
  companies: Company[]
  suppliers: RetailSupplier[]
  customers: RetailCustomer[]
  projects: RetailProject[]
  contracts: RetailContract[]
  milestones: RetailMilestone[]
  invoiceCategories: InvoiceCategory[]
  refunds: Refund[]
}

export const RetailInvoiceFormFields: React.FC<RetailInvoiceFormFieldsProps> = ({
  formData,
  setFormData,
  companies,
  suppliers,
  customers,
  projects,
  contracts,
  milestones,
  invoiceCategories,
  refunds
}) => {
  const { t } = useTranslation()
  const getEntityOptions = () => {
    if (formData.entity_type === 'supplier') {
      return suppliers.map(s => ({ id: s.id, name: s.name }))
    } else {
      return customers.map(c => ({ id: c.id, name: c.name }))
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField label={t('invoices.retail.type_label')} required>
        <Select
          value={formData.invoice_type}
          onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value as 'incoming' | 'outgoing' })}
        >
          <option value="incoming">{t('invoices.retail.type_incoming')}</option>
          <option value="outgoing">{t('invoices.retail.type_outgoing')}</option>
        </Select>
      </FormField>

      <FormField label={t('invoices.retail.entity_type_label')} required>
        <Select
          value={formData.entity_type}
          onChange={(e) => setFormData({ ...formData, entity_type: e.target.value as 'customer' | 'supplier' })}
        >
          <option value="supplier">{t('invoices.retail.entity_supplier')}</option>
          <option value="customer">{t('invoices.retail.entity_customer')}</option>
        </Select>
      </FormField>

      <FormField label={formData.entity_type === 'supplier' ? t('invoices.retail.entity_supplier') : t('invoices.retail.entity_customer')} required>
        <Select
          value={formData.entity_id}
          onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
        >
          <option value="">{formData.entity_type === 'supplier' ? t('invoices.retail.select_supplier') : t('invoices.retail.select_customer')}</option>
          {getEntityOptions().map(entity => (
            <option key={entity.id} value={entity.id}>{entity.name}</option>
          ))}
        </Select>
      </FormField>

      {formData.invoice_type === 'incoming' && formData.entity_type === 'supplier' && (
        <FormField label={t('invoices.retail.refund_label')}>
          <Select
            value={formData.refund_id}
            onChange={(e) => setFormData({ ...formData, refund_id: e.target.value })}
          >
            <option value="">{t('invoices.retail.no_refund')}</option>
            {refunds.map(refund => (
              <option key={refund.id} value={refund.id}>{refund.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField label={t('invoices.retail.company_label')} required>
        <Select
          value={formData.company_id}
          onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
        >
          <option value="">{t('invoices.retail.select_company')}</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </Select>
      </FormField>

      <FormField label={t('invoices.retail.project_label')} required>
        <Select
          value={formData.retail_project_id}
          onChange={(e) => setFormData({ ...formData, retail_project_id: e.target.value })}
        >
          <option value="">{t('invoices.retail.select_project')}</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.plot_number ? `${project.plot_number} - ` : ''}{project.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={t('invoices.retail.contract_label')} required>
        <Select
          value={formData.retail_contract_id}
          onChange={(e) => setFormData({ ...formData, retail_contract_id: e.target.value })}
          disabled={!formData.retail_project_id || !formData.entity_id}
        >
          <option value="">
            {!formData.retail_project_id || !formData.entity_id
              ? t('invoices.retail.select_contract_first')
              : contracts.length === 0
              ? t('invoices.retail.no_contracts')
              : t('invoices.retail.select_contract')}
          </option>
          {contracts.map(contract => (
            <option key={contract.id} value={contract.id}>
              {contract.contract_number} - {contract.phases?.phase_name}
            </option>
          ))}
        </Select>
      </FormField>

      <div>
        <FormField label={t('invoices.retail.milestone_label')}>
          <Select
            value={formData.retail_milestone_id}
            onChange={(e) => setFormData({ ...formData, retail_milestone_id: e.target.value })}
            disabled={!formData.retail_contract_id}
          >
            <option value="">
              {!formData.retail_contract_id
                ? t('invoices.retail.select_milestone_first')
                : milestones.length === 0
                ? t('invoices.retail.no_milestones')
                : t('invoices.retail.select_milestone')}
            </option>
            {milestones.map(milestone => (
              <option key={milestone.id} value={milestone.id}>
                #{milestone.milestone_number} - {milestone.milestone_name} ({milestone.percentage}%)
                {milestone.status === 'paid' ? ' ✓ Plaćeno' :
                 milestone.status === 'pending' ? ' ⏳ U čekanju' :
                 ' ✗ Otkazano'}
              </option>
            ))}
          </Select>
        </FormField>
        {formData.retail_milestone_id && milestones.find(m => m.id === formData.retail_milestone_id)?.status === 'paid' && (
          <Alert variant="warning" className="mt-1">
            {t('invoices.retail.milestone_paid_warning')}
          </Alert>
        )}
      </div>

      <FormField label={t('invoices.form.number_label')} required>
        <Input
          type="text"
          value={formData.invoice_number}
          onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
          placeholder="npr. INV-2025-001"
        />
      </FormField>

      <FormField label={t('invoices.form.reference_label')}>
        <Input
          type="text"
          value={formData.reference_number}
          onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
          placeholder="HR12-3456-7890"
        />
      </FormField>

      <FormField label={t('invoices.form.iban_label')}>
        <Input
          type="text"
          value={formData.iban}
          onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
          placeholder="HR1234567890123456789"
        />
      </FormField>

      <FormField label={t('invoices.form.issue_date_label')} required>
        <DateInput
          value={formData.issue_date}
          onChange={(value) => setFormData({ ...formData, issue_date: value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </FormField>

      <FormField label={t('invoices.form.due_date_label')} required>
        <DateInput
          value={formData.due_date}
          onChange={(value) => setFormData({ ...formData, due_date: value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </FormField>

      <FormField label={t('invoices.retail.base_25')}>
        <CurrencyInput
          value={formData.base_amount_1}
          onChange={(value) => setFormData({ ...formData, base_amount_1: value })}
          placeholder="0,00"
          min={0}
        />
      </FormField>

      <FormField label={t('invoices.retail.base_13')}>
        <CurrencyInput
          value={formData.base_amount_2}
          onChange={(value) => setFormData({ ...formData, base_amount_2: value })}
          placeholder="0,00"
          min={0}
        />
      </FormField>

      <FormField label={t('invoices.retail.base_5')}>
        <CurrencyInput
          value={formData.base_amount_4}
          onChange={(value) => setFormData({ ...formData, base_amount_4: value })}
          placeholder="0,00"
          min={0}
        />
      </FormField>

      <FormField label={t('invoices.retail.base_0')}>
        <CurrencyInput
          value={formData.base_amount_3}
          onChange={(value) => setFormData({ ...formData, base_amount_3: value })}
          placeholder="0,00"
          min={0}
        />
      </FormField>

      <FormField label={t('invoices.form.category_label')} required>
        <Select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        >
          <option value="">{t('invoices.form.select_category')}</option>
          {invoiceCategories.map(cat => (
            <option key={cat.id} value={cat.name}>{cat.name}</option>
          ))}
        </Select>
      </FormField>
    </div>
  )
}
