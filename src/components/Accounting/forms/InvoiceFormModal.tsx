import React from 'react'
import { InvoiceFormFields } from './InvoiceFormFields'
import { InvoiceVATSummary } from './InvoiceVATSummary'
import { Modal, Button } from '../../ui'
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
  return (
    <Modal show={show} onClose={onClose} size="md">
      <Modal.Header
        title={editingInvoice ? 'Uredi račun' : 'Novi račun'}
        onClose={onClose}
      />

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
