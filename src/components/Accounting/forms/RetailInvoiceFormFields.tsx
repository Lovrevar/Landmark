import React from 'react'
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tip računa *
        </label>
        <select
          value={formData.invoice_type}
          onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value as 'incoming' | 'outgoing' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="incoming">Ulazni račun</option>
          <option value="outgoing">Izlazni račun</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tip entiteta *
        </label>
        <select
          value={formData.entity_type}
          onChange={(e) => setFormData({ ...formData, entity_type: e.target.value as 'customer' | 'supplier' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="supplier">Dobavljač</option>
          <option value="customer">Kupac</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {formData.entity_type === 'supplier' ? 'Dobavljač' : 'Kupac'} *
        </label>
        <select
          value={formData.entity_id}
          onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Odaberi {formData.entity_type === 'supplier' ? 'dobavljača' : 'kupca'}</option>
          {getEntityOptions().map(entity => (
            <option key={entity.id} value={entity.id}>{entity.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Moja firma (izdaje račun) *
        </label>
        <select
          value={formData.company_id}
          onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Odaberi firmu</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Retail projekt *
        </label>
        <select
          value={formData.retail_project_id}
          onChange={(e) => setFormData({ ...formData, retail_project_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Odaberi projekt</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.plot_number ? `${project.plot_number} - ` : ''}{project.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ugovor/Faza *
        </label>
        <select
          value={formData.retail_contract_id}
          onChange={(e) => setFormData({ ...formData, retail_contract_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Milestone (opcionalno)
        </label>
        <select
          value={formData.retail_milestone_id}
          onChange={(e) => setFormData({ ...formData, retail_milestone_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
        </select>
        {formData.retail_milestone_id && milestones.find(m => m.id === formData.retail_milestone_id)?.status === 'paid' && (
          <p className="mt-1 text-xs text-amber-600">
            ⚠️ Ovaj milestone je već označen kao plaćen
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Broj računa *
        </label>
        <input
          type="text"
          value={formData.invoice_number}
          onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="npr. INV-2025-001"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Poziv na broj
        </label>
        <input
          type="text"
          value={formData.reference_number}
          onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="HR12-3456-7890"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          IBAN
        </label>
        <input
          type="text"
          value={formData.iban}
          onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="HR1234567890123456789"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Datum izdavanja *
        </label>
        <DateInput
          value={formData.issue_date}
          onChange={(value) => setFormData({ ...formData, issue_date: value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Datum dospijeća *
        </label>
        <DateInput
          value={formData.due_date}
          onChange={(value) => setFormData({ ...formData, due_date: value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Osnovica PDV 25% (€)
        </label>
        <CurrencyInput
          value={formData.base_amount_1}
          onChange={(value) => setFormData({ ...formData, base_amount_1: value })}
          placeholder="0,00"
          min={0}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Osnovica PDV 13% (€)
        </label>
        <CurrencyInput
          value={formData.base_amount_2}
          onChange={(value) => setFormData({ ...formData, base_amount_2: value })}
          placeholder="0,00"
          min={0}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Osnovica PDV 5% (€)
        </label>
        <CurrencyInput
          value={formData.base_amount_4}
          onChange={(value) => setFormData({ ...formData, base_amount_4: value })}
          placeholder="0,00"
          min={0}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Osnovica PDV 0% (€)
        </label>
        <CurrencyInput
          value={formData.base_amount_2}
          onChange={(value) => setFormData({ ...formData, base_amount_3: value })}
          placeholder="0,00"
          min={0}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kategorija *
        </label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Odaberi kategoriju</option>
          {invoiceCategories.map(cat => (
            <option key={cat.id} value={cat.name}>{cat.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
