import React from 'react'
import DateInput from '../../Common/DateInput'
import CurrencyInput from '../../Common/CurrencyInput'
import { InvoiceEntityFields } from './InvoiceEntityFields'
import { Select, Input, Textarea, FormField } from '../../ui'
import type { Company, Supplier, OfficeSupplier, Customer, Project, Contract, Milestone, Refund } from '../types/invoiceTypes'

interface InvoiceFormFieldsProps {
  formData: any
  isOfficeInvoice: boolean
  editingInvoice: any
  companies: Company[]
  suppliers: Supplier[]
  officeSuppliers: OfficeSupplier[]
  customers: Customer[]
  banks: any[]
  projects: Project[]
  contracts: Contract[]
  milestones: Milestone[]
  refunds: Refund[]
  invoiceCategories: { id: string; name: string }[]
  customerApartments: any[]
  onFormChange: (data: any) => void
  getCustomerProjects: (customerId: string) => Project[]
  getCustomerApartmentsByProject: (customerId: string, projectId: string) => any[]
  getSupplierProjects: (supplierId: string) => Project[]
  getSupplierContractsByProject: (supplierId: string, projectId: string) => Contract[]
  getMilestonesByContract: (contractId: string) => Milestone[]
}

export const InvoiceFormFields: React.FC<InvoiceFormFieldsProps> = ({
  formData,
  isOfficeInvoice,
  editingInvoice,
  companies,
  suppliers,
  officeSuppliers,
  customers,
  banks,
  projects,
  refunds,
  invoiceCategories,
  onFormChange,
  getCustomerProjects,
  getCustomerApartmentsByProject,
  getSupplierProjects,
  getSupplierContractsByProject,
  getMilestonesByContract
}) => {
  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Tip računa" required>
          <Select
            value={formData.invoice_type}
            onChange={(e) => onFormChange({
              ...formData,
              invoice_type: e.target.value as 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE',
              supplier_id: '',
              office_supplier_id: '',
              customer_id: '',
              investor_id: '',
              bank_id: '',
              apartment_id: '',
              contract_id: '',
              milestone_id: ''
            })}
            required
            disabled={editingInvoice !== null}
          >
            {isOfficeInvoice ? (
              <>
                <option value="INCOMING_OFFICE">Ulazni</option>
                <option value="OUTGOING_OFFICE">Izlazni</option>
              </>
            ) : (
              <>
                <option value="INCOMING_SUPPLIER">Ulazni (Dobavljač)</option>
                <option value="INCOMING_INVESTMENT">Ulazni (Investicije)</option>
                <option value="OUTGOING_SUPPLIER">Izlazni (Dobavljač)</option>
                <option value="OUTGOING_SALES">Izlazni (Prodaja)</option>
              </>
            )}
          </Select>
        </FormField>

        <InvoiceEntityFields
          formData={formData}
          isOfficeInvoice={isOfficeInvoice}
          suppliers={suppliers}
          officeSuppliers={officeSuppliers}
          customers={customers}
          banks={banks}
          projects={projects}
          refunds={refunds}
          onFormChange={onFormChange}
          getCustomerProjects={getCustomerProjects}
          getCustomerApartmentsByProject={getCustomerApartmentsByProject}
          getSupplierProjects={getSupplierProjects}
          getSupplierContractsByProject={getSupplierContractsByProject}
          getMilestonesByContract={getMilestonesByContract}
        />

        <FormField label="Firma" required>
          <Select
            value={formData.company_id}
            onChange={(e) => onFormChange({ ...formData, company_id: e.target.value })}
            required
          >
            <option value="">Odaberi firmu</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Broj računa" required>
          <Input
            type="text"
            value={formData.invoice_number}
            onChange={(e) => onFormChange({ ...formData, invoice_number: e.target.value })}
            required
          />
        </FormField>

        <FormField label="Poziv na broj">
          <Input
            type="text"
            value={formData.reference_number}
            onChange={(e) => onFormChange({ ...formData, reference_number: e.target.value })}
            placeholder="HR12-3456-7890"
          />
        </FormField>

        <FormField label="IBAN">
          <Input
            type="text"
            value={formData.iban}
            onChange={(e) => onFormChange({ ...formData, iban: e.target.value })}
            placeholder="HR1234567890123456789"
          />
        </FormField>

        <FormField label="Datum izdavanja" required>
          <DateInput
            value={formData.issue_date}
            onChange={(value) => onFormChange({ ...formData, issue_date: value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </FormField>

        <FormField label="Datum dospijeća" required>
          <DateInput
            value={formData.due_date}
            onChange={(value) => onFormChange({ ...formData, due_date: value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </FormField>

        <FormField label="Osnovica PDV 25%">
          <CurrencyInput
            value={formData.base_amount_1}
            onChange={(value) => onFormChange({ ...formData, base_amount_1: value })}
            placeholder="0,00"
            min={0}
          />
        </FormField>

        <FormField label="Osnovica PDV 13%">
          <CurrencyInput
            value={formData.base_amount_2}
            onChange={(value) => onFormChange({ ...formData, base_amount_2: value })}
            placeholder="0,00"
            min={0}
          />
        </FormField>

        <FormField label="Osnovica PDV 5%">
          <CurrencyInput
            value={formData.base_amount_4}
            onChange={(value) => onFormChange({ ...formData, base_amount_4: value })}
            placeholder="0,00"
            min={0}
          />
        </FormField>

        <FormField label="Osnovica PDV 0%">
          <CurrencyInput
            value={formData.base_amount_3}
            onChange={(value) => onFormChange({ ...formData, base_amount_3: value })}
            placeholder="0,00"
            min={0}
          />
        </FormField>

        <FormField label="Kategorija" required>
          <Select
            value={formData.category}
            onChange={(e) => onFormChange({ ...formData, category: e.target.value })}
            required
          >
            <option value="">Odaberi kategoriju</option>
            {invoiceCategories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Opis (opcionalno)">
        <Textarea
          value={formData.description}
          onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
          rows={3}
          placeholder="Dodatne napomene..."
        />
      </FormField>
    </div>
  )
}
