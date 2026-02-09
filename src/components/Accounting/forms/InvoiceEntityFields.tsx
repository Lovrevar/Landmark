import React from 'react'
import { formatCurrency } from '../../Common/CurrencyInput'
import { Select, FormField } from '../../ui'
import type { Supplier, OfficeSupplier, Customer, Project, Contract, Milestone, Refund } from '../types/invoiceTypes'

interface InvoiceEntityFieldsProps {
  formData: any
  isOfficeInvoice: boolean
  suppliers: Supplier[]
  officeSuppliers: OfficeSupplier[]
  customers: Customer[]
  investors: any[]
  banks: any[]
  projects: Project[]
  refunds: Refund[]
  onFormChange: (data: any) => void
  getCustomerProjects: (customerId: string) => Project[]
  getCustomerApartmentsByProject: (customerId: string, projectId: string) => any[]
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
  investors,
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
  return (
    <>
      {formData.invoice_type === 'INCOMING_SUPPLIER' && (
        <FormField label="Dobavljač" required>
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
            required
          >
            <option value="">Odaberi dobavljača</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {formData.invoice_type === 'INCOMING_SUPPLIER' && (
        <FormField label="Refundacija (opcionalno)">
          <Select
            value={formData.refund_id}
            onChange={(e) => onFormChange({ ...formData, refund_id: e.target.value })}
          >
            <option value="">Bez refundacije</option>
            {refunds.map(refund => (
              <option key={refund.id} value={refund.id}>{refund.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {(formData.invoice_type === 'INCOMING_OFFICE' || formData.invoice_type === 'OUTGOING_OFFICE') && (
        <FormField label="Office Dobavljač" required>
          <Select
            value={formData.office_supplier_id}
            onChange={(e) => onFormChange({ ...formData, office_supplier_id: e.target.value })}
            required
          >
            <option value="">Odaberi office dobavljača</option>
            {officeSuppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {formData.invoice_type === 'INCOMING_OFFICE' && (
        <FormField label="Refundacija (opcionalno)">
          <Select
            value={formData.refund_id}
            onChange={(e) => onFormChange({ ...formData, refund_id: e.target.value })}
          >
            <option value="">Bez refundacije</option>
            {refunds.map(refund => (
              <option key={refund.id} value={refund.id}>{refund.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {formData.invoice_type === 'INCOMING_INVESTMENT' && (
        <>
          <FormField label="Investor (opcionalno)">
            <Select
              value={formData.investor_id}
              onChange={(e) => onFormChange({ ...formData, investor_id: e.target.value, bank_id: '' })}
            >
              <option value="">Bez investora</option>
              {investors.map(investor => (
                <option key={investor.id} value={investor.id}>{investor.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Banka (opcionalno)">
            <Select
              value={formData.bank_id}
              onChange={(e) => onFormChange({ ...formData, bank_id: e.target.value, investor_id: '' })}
            >
              <option value="">Bez banke</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </Select>
          </FormField>
        </>
      )}

      {formData.invoice_type === 'OUTGOING_SUPPLIER' && (
        <FormField label="Dobavljač" required>
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
            required
          >
            <option value="">Odaberi dobavljača</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </Select>
        </FormField>
      )}

      {formData.invoice_type === 'OUTGOING_SALES' && (
        <FormField label="Kupac" required>
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
            required
          >
            <option value="">Odaberi kupca</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.surname}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {!isOfficeInvoice && (
        <FormField label="Projekt (opcionalno)">
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
            <option value="">Bez projekta</option>
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
          <FormField label="Ugovor / Faza (opcionalno)">
            <Select
              value={formData.contract_id}
              onChange={(e) => onFormChange({ ...formData, contract_id: e.target.value, milestone_id: '' })}
            >
              <option value="">Bez ugovora</option>
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
            <FormField label="Milestone (opcionalno)" helperText="Odabir milestone-a će automatski ažurirati osnovicu prema postotku milestone-a">
              <Select
                value={formData.milestone_id}
                onChange={(e) => {
                  const milestoneId = e.target.value
                  if (milestoneId) {
                    const milestone = getMilestonesByContract(formData.contract_id).find(m => m.id === milestoneId)
                    const contract = getSupplierContractsByProject(formData.supplier_id, formData.project_id).find(c => c.id === formData.contract_id)

                    if (milestone && contract) {
                      const contractBaseAmount = contract.contract_amount / 1.25
                      const milestoneBaseAmount = (contractBaseAmount * milestone.percentage) / 100
                      onFormChange({
                        ...formData,
                        milestone_id: milestoneId,
                        base_amount_1: milestoneBaseAmount,
                        base_amount_2: 0,
                        base_amount_3: 0,
                        base_amount_4: 0
                      })
                      return
                    }
                  }
                  onFormChange({ ...formData, milestone_id: milestoneId })
                }}
              >
                <option value="">Bez milestone-a</option>
                {(() => {
                  const contract = getSupplierContractsByProject(formData.supplier_id, formData.project_id).find(c => c.id === formData.contract_id)
                  return getMilestonesByContract(formData.contract_id).map(milestone => {
                    const contractBaseAmount = contract ? contract.contract_amount / 1.25 : 0
                    const milestoneBaseAmount = (contractBaseAmount * milestone.percentage) / 100
                    return (
                      <option key={milestone.id} value={milestone.id}>
                        #{milestone.milestone_number} - {milestone.milestone_name} ({milestone.percentage}% = €{formatCurrency(milestoneBaseAmount)})
                        {milestone.status === 'completed' && ' - Završeno'}
                        {milestone.status === 'pending' && ' - Na čekanju'}
                      </option>
                    )
                  })
                })()}
              </Select>
            </FormField>
          )}
        </>
      )}

      {formData.invoice_type === 'OUTGOING_SALES' && formData.customer_id && (
        <FormField label="Stan (opcionalno)">
          <Select
            value={formData.apartment_id}
            onChange={(e) => onFormChange({ ...formData, apartment_id: e.target.value })}
          >
            <option value="">Odaberi stan</option>
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
