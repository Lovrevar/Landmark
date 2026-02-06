import type { Invoice, Project, Contract, Milestone } from '../types/invoiceTypes'

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'PAID': return 'bg-green-100 text-green-800'
    case 'PARTIALLY_PAID': return 'bg-yellow-100 text-yellow-800'
    case 'UNPAID': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export const getTypeColor = (type: string): string => {
  if (type === 'INCOMING_SUPPLIER' || type === 'INCOMING_OFFICE' || type === 'INCOMING_BANK') {
    return 'text-red-600'
  }
  return 'text-green-600'
}

export const getTypeLabel = (type: string): string => {
  switch (type) {
    case 'INCOMING_SUPPLIER': return 'ULAZNI (DOB)'
    case 'INCOMING_INVESTMENT': return 'ULAZNI (INV)'
    case 'INCOMING_OFFICE': return 'ULAZNI (URED)'
    case 'INCOMING_BANK': return 'ULAZNI (BANKA)'
    case 'OUTGOING_OFFICE': return 'IZLAZNI (URED)'
    case 'OUTGOING_SUPPLIER': return 'IZLAZNI (DOB)'
    case 'OUTGOING_SALES': return 'IZLAZNI (PROD)'
    case 'OUTGOING_BANK': return 'IZLAZNI (BANKA)'
    default: return type
  }
}

export const getSupplierCustomerName = (invoice: Invoice): string => {
  if (invoice.subcontractors?.name) return invoice.subcontractors.name
  if (invoice.retail_suppliers?.name) return invoice.retail_suppliers.name
  if (invoice.office_suppliers?.name) return invoice.office_suppliers.name
  if (invoice.customers) return `${invoice.customers.name} ${invoice.customers.surname}`
  if (invoice.retail_customers?.name) return invoice.retail_customers.name
  if (invoice.investors?.name) return invoice.investors.name
  if (invoice.banks?.name) return invoice.banks.name
  return '-'
}

export const getCustomerProjects = (
  customerId: string,
  projects: Project[],
  customerSales: any[]
): Project[] => {
  if (!customerId) return projects

  const customerProjectIds = new Set(
    customerSales
      .filter(sale => sale.customer_id === customerId)
      .map(sale => sale.apartments?.project_id)
      .filter(Boolean)
  )

  return projects.filter(project => customerProjectIds.has(project.id))
}

export const getCustomerApartmentsByProject = (
  customerId: string,
  projectId: string,
  customerApartments: any[]
): any[] => {
  if (!customerId) return []

  return customerApartments.filter(apt =>
    apt.customer_id === customerId &&
    (!projectId || apt.project_id === projectId)
  )
}

export const getSupplierProjects = (
  supplierId: string,
  projects: Project[],
  contracts: Contract[]
): Project[] => {
  if (!supplierId) return []

  const supplierProjectIds = new Set(
    contracts
      .filter(contract => contract.subcontractor_id === supplierId)
      .map(contract => contract.project_id)
  )

  return projects.filter(project => supplierProjectIds.has(project.id))
}

export const getSupplierContractsByProject = (
  supplierId: string,
  projectId: string,
  contracts: Contract[]
): Contract[] => {
  if (!supplierId) return []

  return contracts.filter(contract =>
    contract.subcontractor_id === supplierId &&
    (!projectId || contract.project_id === projectId)
  )
}

export const getMilestonesByContract = (
  contractId: string,
  milestones: Milestone[]
): Milestone[] => {
  if (!contractId) return []
  return milestones.filter(m => m.contract_id === contractId && m.status !== 'paid')
}

export const isOverdue = (dueDate: string, status: string): boolean => {
  return status !== 'PAID' && new Date(dueDate) < new Date()
}

export const columnLabels = {
  approved: 'Odobreno',
  type: 'Tip',
  invoice_number: 'Broj računa',
  company: 'Firma',
  supplier_customer: 'Dobavljač/Kupac',
  category: 'Kategorija',
  issue_date: 'Datum izdavanja',
  due_date: 'Dospijeće',
  base_amount: 'Osnovica',
  vat: 'PDV',
  total_amount: 'Ukupno',
  paid_amount: 'Plaćeno',
  remaining_amount: 'Preostalo',
  status: 'Status'
}
