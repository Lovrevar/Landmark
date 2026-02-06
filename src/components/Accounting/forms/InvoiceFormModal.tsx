import React from 'react'
import { X } from 'lucide-react'
import { InvoiceFormFields } from './InvoiceFormFields'
import { InvoiceVATSummary } from './InvoiceVATSummary'
import type { Invoice, Company, Supplier, OfficeSupplier, Customer, Project, Contract, Milestone, Refund } from '../types/invoiceTypes'

interface InvoiceFormModalProps {
  show: boolean
  editingInvoice: Invoice | null
  isOfficeInvoice: boolean
  formData: any
  companies: Company[]
  suppliers: Supplier[]
  officeSuppliers: OfficeSupplier[]
  customers: Customer[]
  investors: any[]
  banks: any[]
  projects: Project[]
  contracts: Contract[]
  milestones: Milestone[]
  refunds: Refund[]
  invoiceCategories: { id: string; name: string }[]
  customerApartments: any[]
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onFormChange: (data: any) => void
  getCustomerProjects: (customerId: string) => Project[]
  getCustomerApartmentsByProject: (customerId: string, projectId: string) => any[]
  getSupplierProjects: (supplierId: string) => Project[]
  getSupplierContractsByProject: (supplierId: string, projectId: string) => Contract[]
  getMilestonesByContract: (contractId: string) => Milestone[]
}

export const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({
  show,
  editingInvoice,
  isOfficeInvoice,
  formData,
  companies,
  suppliers,
  officeSuppliers,
  customers,
  investors,
  banks,
  projects,
  contracts,
  milestones,
  refunds,
  invoiceCategories,
  customerApartments,
  onClose,
  onSubmit,
  onFormChange,
  getCustomerProjects,
  getCustomerApartmentsByProject,
  getSupplierProjects,
  getSupplierContractsByProject,
  getMilestonesByContract
}) => {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {editingInvoice ? 'Uredi račun' : 'Novi račun'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="overflow-y-auto flex-1">
          <InvoiceFormFields
            formData={formData}
            isOfficeInvoice={isOfficeInvoice}
            editingInvoice={editingInvoice}
            companies={companies}
            suppliers={suppliers}
            officeSuppliers={officeSuppliers}
            customers={customers}
            investors={investors}
            banks={banks}
            projects={projects}
            contracts={contracts}
            milestones={milestones}
            refunds={refunds}
            invoiceCategories={invoiceCategories}
            customerApartments={customerApartments}
            onFormChange={onFormChange}
            getCustomerProjects={getCustomerProjects}
            getCustomerApartmentsByProject={getCustomerApartmentsByProject}
            getSupplierProjects={getSupplierProjects}
            getSupplierContractsByProject={getSupplierContractsByProject}
            getMilestonesByContract={getMilestonesByContract}
          />

          <InvoiceVATSummary formData={formData} />

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
              {editingInvoice ? 'Spremi promjene' : 'Kreiraj račun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
