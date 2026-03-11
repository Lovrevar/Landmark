import React from 'react'
import { InvoiceFormFields } from './InvoiceFormFields'
import { InvoiceVATSummary } from './InvoiceVATSummary'
import { Modal, Button } from '../../../ui'
import type { Invoice, Company, Supplier, OfficeSupplier, Customer, Project, Contract, Milestone, Refund } from '../types'

interface Bank {
  id: string
  name: string
}

interface Apartment {
  id: string
  number: string
  price: number
  project_id?: string
}

interface InvoiceModalFormData {
  invoice_type: string
  company_id: string
  supplier_id: string
  office_supplier_id: string
  customer_id: string
  bank_id: string
  project_id: string
  contract_id: string
  milestone_id: string
  apartment_id: string
  refund_id: string
  invoice_number: string
  reference_number: string
  iban: string
  issue_date: string
  due_date: string
  base_amount_1: number
  base_amount_2: number
  base_amount_3: number
  base_amount_4: number
  category: string
  description: string
  [key: string]: unknown
}

interface InvoiceFormModalProps {
  show: boolean
  editingInvoice: Invoice | null
  isOfficeInvoice: boolean
  formData: InvoiceModalFormData
  companies: Company[]
  suppliers: Supplier[]
  officeSuppliers: OfficeSupplier[]
  customers: Customer[]
  banks: Bank[]
  projects: Project[]
  contracts: Contract[]
  milestones: Milestone[]
  refunds: Refund[]
  invoiceCategories: { id: string; name: string }[]
  customerApartments: Apartment[]
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onFormChange: (data: InvoiceModalFormData) => void
  getCustomerProjects: (customerId: string) => Project[]
  getCustomerApartmentsByProject: (customerId: string, projectId: string) => Apartment[]
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
  return (
    <Modal show={show} onClose={onClose} size="md">
      <Modal.Header
        title={editingInvoice ? 'Uredi račun' : 'Novi račun'}
        onClose={onClose}
      />

      <form onSubmit={onSubmit} className="overflow-y-auto flex-1 flex flex-col">
        <Modal.Body noPadding>
          <InvoiceFormFields
            formData={formData}
            isOfficeInvoice={isOfficeInvoice}
            editingInvoice={editingInvoice}
            companies={companies}
            suppliers={suppliers}
            officeSuppliers={officeSuppliers}
            customers={customers}
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
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            Odustani
          </Button>
          <Button type="submit">
            {editingInvoice ? 'Spremi promjene' : 'Kreiraj račun'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
