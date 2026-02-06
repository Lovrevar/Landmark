import React from 'react'
import { formatCurrency } from '../../Common/CurrencyInput'
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dobavljač *
          </label>
          <select
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Odaberi dobavljača</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </div>
      )}

      {formData.invoice_type === 'INCOMING_SUPPLIER' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Refundacija (opcionalno)
          </label>
          <select
            value={formData.refund_id}
            onChange={(e) => onFormChange({ ...formData, refund_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Bez refundacije</option>
            {refunds.map(refund => (
              <option key={refund.id} value={refund.id}>{refund.name}</option>
            ))}
          </select>
        </div>
      )}

      {(formData.invoice_type === 'INCOMING_OFFICE' || formData.invoice_type === 'OUTGOING_OFFICE') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Office Dobavljač *
          </label>
          <select
            value={formData.office_supplier_id}
            onChange={(e) => onFormChange({ ...formData, office_supplier_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Odaberi office dobavljača</option>
            {officeSuppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </div>
      )}

      {formData.invoice_type === 'INCOMING_OFFICE' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Refundacija (opcionalno)
          </label>
          <select
            value={formData.refund_id}
            onChange={(e) => onFormChange({ ...formData, refund_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Bez refundacije</option>
            {refunds.map(refund => (
              <option key={refund.id} value={refund.id}>{refund.name}</option>
            ))}
          </select>
        </div>
      )}

      {formData.invoice_type === 'INCOMING_INVESTMENT' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Investor (opcionalno)
            </label>
            <select
              value={formData.investor_id}
              onChange={(e) => onFormChange({ ...formData, investor_id: e.target.value, bank_id: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Bez investora</option>
              {investors.map(investor => (
                <option key={investor.id} value={investor.id}>{investor.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Banka (opcionalno)
            </label>
            <select
              value={formData.bank_id}
              onChange={(e) => onFormChange({ ...formData, bank_id: e.target.value, investor_id: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Bez banke</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {formData.invoice_type === 'OUTGOING_SUPPLIER' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dobavljač *
          </label>
          <select
            value={formData.supplier_id}
            onChange={(e) => onFormChange({ ...formData, supplier_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Odaberi dobavljača</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </div>
      )}

      {formData.invoice_type === 'OUTGOING_SALES' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kupac *
          </label>
          <select
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Odaberi kupca</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.surname}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isOfficeInvoice && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Projekt (opcionalno)
          </label>
          <select
            value={formData.project_id}
            onChange={(e) => onFormChange({
              ...formData,
              project_id: e.target.value,
              apartment_id: '',
              contract_id: '',
              milestone_id: ''
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          </select>
        </div>
      )}

      {(formData.invoice_type === 'INCOMING_SUPPLIER' || formData.invoice_type === 'OUTGOING_SUPPLIER') && formData.supplier_id && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ugovor / Faza (opcionalno)
            </label>
            <select
              value={formData.contract_id}
              onChange={(e) => onFormChange({ ...formData, contract_id: e.target.value, milestone_id: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Bez ugovora</option>
              {getSupplierContractsByProject(formData.supplier_id, formData.project_id).map(contract => (
                <option key={contract.id} value={contract.id}>
                  {contract.contract_number} - {contract.projects?.name || 'N/A'}
                  {contract.phases?.phase_name && ` - ${contract.phases.phase_name}`}
                  {contract.job_description && ` (${contract.job_description})`}
                </option>
              ))}
            </select>
          </div>

          {formData.contract_id && getMilestonesByContract(formData.contract_id).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Milestone (opcionalno)
              </label>
              <select
                value={formData.milestone_id}
                onChange={(e) => onFormChange({ ...formData, milestone_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Bez milestone-a</option>
                {getMilestonesByContract(formData.contract_id).map(milestone => (
                  <option key={milestone.id} value={milestone.id}>
                    #{milestone.milestone_number} - {milestone.milestone_name} ({milestone.percentage}%)
                    {milestone.status === 'completed' && ' - Završeno'}
                    {milestone.status === 'pending' && ' - Na čekanju'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Odabir milestone-a će automatski ažurirati njegov status na "plaćen"
              </p>
            </div>
          )}
        </>
      )}

      {formData.invoice_type === 'OUTGOING_SALES' && formData.customer_id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stan (opcionalno)
          </label>
          <select
            value={formData.apartment_id}
            onChange={(e) => onFormChange({ ...formData, apartment_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Odaberi stan</option>
            {getCustomerApartmentsByProject(formData.customer_id, formData.project_id).map(apt => (
              <option key={apt.id} value={apt.id}>
                {apt.projects?.name} - {apt.buildings?.name} - Apt {apt.number} (€{formatCurrency(apt.price)})
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  )
}
