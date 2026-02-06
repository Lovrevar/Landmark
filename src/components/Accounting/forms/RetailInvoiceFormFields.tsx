import React from 'react'
import { FormField, Select, Input, Alert } from '../../ui'
import DateInput from '../../Common/DateInput'
import CurrencyInput from '../../Common/CurrencyInput'
import {
  Company,
  RetailSupplier,
  RetailCustomer,
  RetailProject,
  RetailContract,
  RetailMilestone,
  InvoiceCategory,
  RetailInvoiceFormData
} from '../types/retailInvoiceTypes'

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
  invoiceCategories
}) => {
  const getEntityOptions = () => {
    if (formData.entity_type === 'supplier') {
      return suppliers.map(s => ({ id: s.id, name: s.name }))
    } else {
      return customers.map(c => ({ id: c.id, name: c.name }))
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField label="Tip računa" required>
        <Select
          value={formData.invoice_type}
          onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value as 'incoming' | 'outgoing' })}
          required
        >
          <option value="incoming">Ulazni račun</option>
          <option value="outgoing">Izlazni račun</option>
        </Select>
      </FormField>

      <FormField label="Tip entiteta" required>
        <Select
          value={formData.entity_type}
          onChange={(e) => setFormData({ ...formData, entity_type: e.target.value as 'customer' | 'supplier' })}
          required
        >
          <option value="supplier">Dobavljač</option>
          <option value="customer">Kupac</option>
        </Select>
      </FormField>

      <FormField label={formData.entity_type === 'supplier' ? 'Dobavljač' : 'Kupac'} required>
        <Select
          value={formData.entity_id}
          onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
          required
        >
          <option value="">Odaberi {formData.entity_type === 'supplier' ? 'dobavljača' : 'kupca'}</option>
          {getEntityOptions().map(entity => (
            <option key={entity.id} value={entity.id}>{entity.name}</option>
          ))}
        </Select>
      </FormField>

      <FormField label="Moja firma (izdaje račun)" required>
        <Select
          value={formData.company_id}
          onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
          required
        >
          <option value="">Odaberi firmu</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </Select>
      </FormField>

      <FormField label="Retail projekt" required>
        <Select
          value={formData.retail_project_id}
          onChange={(e) => setFormData({ ...formData, retail_project_id: e.target.value })}
          required
        >
          <option value="">Odaberi projekt</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.plot_number ? `${project.plot_number} - ` : ''}{project.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Ugovor/Faza" required>
        <Select
          value={formData.retail_contract_id}
          onChange={(e) => setFormData({ ...formData, retail_contract_id: e.target.value })}
          required
          disabled={!formData.retail_project_id || !formData.entity_id}
        >
          <option value="">
            {!formData.retail_project_id || !formData.entity_id
              ? 'Odaberi projekt i entitet prvo'
              : contracts.length === 0
              ? 'Nema dostupnih ugovora'
              : 'Odaberi ugovor'}
          </option>
          {contracts.map(contract => (
            <option key={contract.id} value={contract.id}>
              {contract.contract_number} - {contract.phases?.phase_name}
            </option>
          ))}
        </Select>
      </FormField>

      <div>
        <FormField label="Milestone (opcionalno)">
          <Select
            value={formData.retail_milestone_id}
            onChange={(e) => setFormData({ ...formData, retail_milestone_id: e.target.value })}
            disabled={!formData.retail_contract_id}
          >
            <option value="">
              {!formData.retail_contract_id
                ? 'Odaberi ugovor prvo'
                : milestones.length === 0
                ? 'Nema dostupnih milestones'
                : 'Odaberi milestone (opcionalno)'}
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
            Ovaj milestone je već označen kao plaćen
          </Alert>
        )}
      </div>

      <FormField label="Broj računa" required>
        <Input
          type="text"
          value={formData.invoice_number}
          onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
          placeholder="npr. INV-2025-001"
          required
        />
      </FormField>

      <FormField label="Poziv na broj">
        <Input
          type="text"
          value={formData.reference_number}
          onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
          placeholder="HR12-3456-7890"
        />
      </FormField>

      <FormField label="IBAN">
        <Input
          type="text"
          value={formData.iban}
          onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
          placeholder="HR1234567890123456789"
        />
      </FormField>

      <FormField label="Datum izdavanja" required>
        <DateInput
          value={formData.issue_date}
          onChange={(value) => setFormData({ ...formData, issue_date: value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
      </FormField>

      <FormField label="Datum dospijeća" required>
        <DateInput
          value={formData.due_date}
          onChange={(value) => setFormData({ ...formData, due_date: value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
      </FormField>

      <FormField label="Osnovica PDV 25% (€)">
        <CurrencyInput
          value={formData.base_amount_1}
          onChange={(value) => setFormData({ ...formData, base_amount_1: value })}
          placeholder="0,00"
          min={0}
        />
      </FormField>

      <FormField label="Osnovica PDV 13% (€)">
        <CurrencyInput
          value={formData.base_amount_2}
          onChange={(value) => setFormData({ ...formData, base_amount_2: value })}
          placeholder="0,00"
          min={0}
        />
      </FormField>

      <FormField label="Osnovica PDV 5% (€)">
        <CurrencyInput
          value={formData.base_amount_4}
          onChange={(value) => setFormData({ ...formData, base_amount_4: value })}
          placeholder="0,00"
          min={0}
        />
      </FormField>

      <FormField label="Osnovica PDV 0% (€)">
        <CurrencyInput
          value={formData.base_amount_2}
          onChange={(value) => setFormData({ ...formData, base_amount_3: value })}
          placeholder="0,00"
          min={0}
        />
      </FormField>

      <FormField label="Kategorija" required>
        <Select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          required
        >
          <option value="">Odaberi kategoriju</option>
          {invoiceCategories.map(cat => (
            <option key={cat.id} value={cat.name}>{cat.name}</option>
          ))}
        </Select>
      </FormField>
    </div>
  )
}
