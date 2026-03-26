import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../Common/CurrencyInput'
import { Select, FormField } from '../../ui'
import type { Supplier, OfficeSupplier, Customer, Project, Contract, Milestone, Refund } from '../Invoices/types'

interface Bank {
  id: string
  name: string
}

interface InvoiceFormData {
  invoice_type: string
  supplier_id: string
  office_supplier_id: string
  customer_id: string
  bank_id: string
  project_id: string
  contract_id: string
  milestone_id: string
  apartment_id: string
  refund_id: string
  [key: string]: unknown
}

interface Apartment {
  id: string
  number: string
  price: number
  project_id?: string
  projects?: { name: string }
  buildings?: { name: string }
}

interface InvoiceEntityFieldsProps {
  formData: InvoiceFormData
  isOfficeInvoice: boolean
  suppliers: Supplier[]
  officeSuppliers: OfficeSupplier[]
  customers: Customer[]
  banks: Bank[]
  projects: Project[]
  refunds: Refund[]
  onFormChange: (data: InvoiceFormData) => void
  getCustomerProjects: (customerId: string) => Project[]
  getCustomerApartmentsByProject: (customerId: string, projectId: string) => Apartment[]
  getSupplierProjects: (supplierId: string) => Project[]
  getSupplierContractsByProject: (supplierId: string, projectId: string) => Contract[]
  getMilestonesByContract: (contractId: string) => Milestone[]
}

export const InvoiceEntityFields: React.FC<InvoiceEntityFieldsProps> = ({
  formData,
  isOfficeInvoice,
  suppliers,
  officeSuppliers,
  customers,
  banks,
  projects,
  refunds,
  onFormChange,
  getCustomerProjects,
  getCustomerApartmentsByProject,
  getSupplierProjects,
  getSupplierContractsByProject,
  getMilestonesByContract
}) => {
  const { t } = useTranslation()

  return (
    <>
      {formData.invoice_type === 'INCOMING_SUPPLIER' && (
        <FormField label={t('invoice_entity.supplier_label')} required>
          <Select
            value={formData.supplier_id}
            onChange={(e) => {
              const newSupplierId = e.target.value
              const supplierProjects = getSupplierProjects(newSupplierId)
              const currentProjectInList = supplierProjects.some(p => p.id === formData.project_id)

              onFormChange({
                ...formData,
                supplier_id: newSupplierId,
                project_id: currentProjectInList ? formData.project_id : '',
                contract_id: '',
                milestone_id: ''
              })
            }}
          >
            <option value="">{t('invoice_entity.supplier_placeholder')}</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {formData.invoice_type === 'INCOMING_SUPPLIER' && (
        <FormField label={t('invoice_entity.refund_label')}>
          <Select
            value={formData.refund_id}
            onChange={(e) => onFormChange({ ...formData, refund_id: e.target.value })}
          >
            <option value="">{t('invoice_entity.no_refund')}</option>
            {refunds.map(refund => (
              <option key={refund.id} value={refund.id}>{refund.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {(formData.invoice_type === 'INCOMING_OFFICE' || formData.invoice_type === 'OUTGOING_OFFICE') && (
        <FormField label={formData.invoice_type === 'OUTGOING_OFFICE' ? t('invoice_entity.office_buyer_label') : t('invoice_entity.office_supplier_label')} required>
          <Select
            value={formData.office_supplier_id}
            onChange={(e) => onFormChange({ ...formData, office_supplier_id: e.target.value })}
          >
            <option value="">{formData.invoice_type === 'OUTGOING_OFFICE' ? t('invoice_entity.office_buyer_placeholder') : t('invoice_entity.office_supplier_placeholder')}</option>
            {officeSuppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {formData.invoice_type === 'INCOMING_OFFICE' && (
        <FormField label={t('invoice_entity.refund_label')}>
          <Select
            value={formData.refund_id}
            onChange={(e) => onFormChange({ ...formData, refund_id: e.target.value })}
          >
            <option value="">{t('invoice_entity.no_refund')}</option>
            {refunds.map(refund => (
              <option key={refund.id} value={refund.id}>{refund.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {formData.invoice_type === 'INCOMING_INVESTMENT' && (
        <FormField label={t('invoice_entity.bank_label')}>
          <Select
            value={formData.bank_id}
            onChange={(e) => onFormChange({ ...formData, bank_id: e.target.value })}
          >
            <option value="">{t('invoice_entity.no_bank')}</option>
            {banks.map(bank => (
              <option key={bank.id} value={bank.id}>{bank.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {formData.invoice_type === 'OUTGOING_SUPPLIER' && (
        <FormField label={t('invoice_entity.buyer_label')} required>
          <Select
            value={formData.supplier_id}
            onChange={(e) => onFormChange({ ...formData, supplier_id: e.target.value })}
          >
            <option value="">{t('invoice_entity.buyer_placeholder')}</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {formData.invoice_type === 'OUTGOING_SALES' && (
        <FormField label={t('invoice_entity.buyer_label')} required>
          <Select
            value={formData.customer_id}
            onChange={(e) => {
              const newCustomerId = e.target.value
              const customerProjects = getCustomerProjects(newCustomerId)
              const currentProjectInList = customerProjects.some(p => p.id === formData.project_id)

              onFormChange({
                ...formData,
                customer_id: newCustomerId,
                project_id: currentProjectInList ? formData.project_id : '',
                apartment_id: ''
              })
            }}
          >
            <option value="">{t('invoice_entity.buyer_placeholder')}</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.surname}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {!isOfficeInvoice && (
        <FormField label={t('invoice_entity.project_label')}>
          <Select
            value={formData.project_id}
            onChange={(e) => onFormChange({
              ...formData,
              project_id: e.target.value,
              apartment_id: '',
              contract_id: '',
              milestone_id: ''
            })}
          >
            <option value="">{t('invoice_entity.no_project')}</option>
            {(formData.invoice_type === 'OUTGOING_SALES' && formData.customer_id
              ? getCustomerProjects(formData.customer_id)
              : formData.invoice_type === 'INCOMING_SUPPLIER' && formData.supplier_id
              ? getSupplierProjects(formData.supplier_id)
              : projects
            ).map(project => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {(formData.invoice_type === 'INCOMING_SUPPLIER' || formData.invoice_type === 'OUTGOING_SUPPLIER') && formData.supplier_id && (
        <>
          <FormField
            label={formData.project_id ? t('invoice_entity.contract_label') : t('invoice_entity.contract_optional_label')}
            required={!!formData.project_id}
          >
            <Select
              value={formData.contract_id}
              onChange={(e) => onFormChange({ ...formData, contract_id: e.target.value, milestone_id: '' })}
            >
              <option value="">{t('invoice_entity.no_contract')}</option>
              {getSupplierContractsByProject(formData.supplier_id, formData.project_id).map(contract => (
                <option key={contract.id} value={contract.id}>
                  {contract.contract_number} - {contract.projects?.name || 'N/A'}
                  {contract.phases?.phase_name && ` - ${contract.phases.phase_name}`}
                  {contract.job_description && ` (${contract.job_description})`}
                </option>
              ))}
            </Select>
          </FormField>

          {formData.contract_id && getMilestonesByContract(formData.contract_id).length > 0 && (
            <FormField label={t('invoice_entity.milestone_label')} helperText={t('invoice_entity.milestone_helper')}>
              <Select
                value={formData.milestone_id}
                onChange={(e) => onFormChange({ ...formData, milestone_id: e.target.value })}
              >
                <option value="">{t('invoice_entity.no_milestone')}</option>
                {getMilestonesByContract(formData.contract_id).map(milestone => {
                  const remainingText = milestone.remaining_amount !== undefined
                    ? `${t('invoice_entity.milestone_remaining')}${milestone.remaining_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : ''

                  return (
                    <option key={milestone.id} value={milestone.id}>
                      #{milestone.milestone_number} - {milestone.milestone_name} ({milestone.percentage}%)
                      {milestone.status === 'completed' && t('invoice_entity.milestone_completed')}
                      {milestone.status === 'pending' && t('invoice_entity.milestone_pending')}
                      {remainingText}
                    </option>
                  )
                })}
              </Select>
            </FormField>
          )}
        </>
      )}

      {formData.invoice_type === 'OUTGOING_SALES' && formData.customer_id && (
        <FormField label={t('invoice_entity.apartment_label')}>
          <Select
            value={formData.apartment_id}
            onChange={(e) => onFormChange({ ...formData, apartment_id: e.target.value })}
          >
            <option value="">{t('invoice_entity.apartment_placeholder')}</option>
            {getCustomerApartmentsByProject(formData.customer_id, formData.project_id).map(apt => (
              <option key={apt.id} value={apt.id}>
                {apt.projects?.name} - {apt.buildings?.name} - Apt {apt.number} (€{formatCurrency(apt.price)})
              </option>
            ))}
          </Select>
        </FormField>
      )}
    </>
  )
}
