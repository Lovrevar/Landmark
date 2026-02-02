import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X } from 'lucide-react'
import DateInput from '../Common/DateInput'
import CurrencyInput, { formatCurrency } from '../Common/CurrencyInput'

interface Company {
  id: string
  name: string
}

interface RetailSupplier {
  id: string
  name: string
  contact_person: string | null
}

interface RetailCustomer {
  id: string
  name: string
  contact_email: string | null
}

interface RetailProject {
  id: string
  name: string
  plot_number: string | null
}

interface RetailContract {
  id: string
  contract_number: string
  phase_id: string
  supplier_id: string | null
  customer_id: string | null
  phases?: {
    phase_type: string
    phase_name: string
  }
}

interface RetailMilestone {
  id: string
  milestone_number: number
  milestone_name: string
  percentage: number
  status: 'pending' | 'paid' | 'cancelled'
  due_date: string | null
}

interface RetailInvoiceFormModalProps {
  onClose: () => void
  onSuccess: () => void
}

export const RetailInvoiceFormModal: React.FC<RetailInvoiceFormModalProps> = ({
  onClose,
  onSuccess
}) => {
  const [companies, setCompanies] = useState<Company[]>([])
  const [suppliers, setSuppliers] = useState<RetailSupplier[]>([])
  const [customers, setCustomers] = useState<RetailCustomer[]>([])
  const [projects, setProjects] = useState<RetailProject[]>([])
  const [contracts, setContracts] = useState<RetailContract[]>([])
  const [milestones, setMilestones] = useState<RetailMilestone[]>([])
  const [invoiceCategories, setInvoiceCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    invoice_type: 'incoming' as 'incoming' | 'outgoing',
    entity_type: 'supplier' as 'customer' | 'supplier',
    entity_id: '',
    company_id: '',
    retail_project_id: '',
    retail_contract_id: '',
    retail_milestone_id: '',
    invoice_number: '',
    issue_date: '',
    due_date: '',
    base_amount: '',
    vat_rate: '25',
    base_amount_1: 0,
    base_amount_2: 0,
    base_amount_3: 0,
    base_amount_4: 0,
    category: '',
    notes: ''
  })

  useEffect(() => {
    loadInitialData()
    loadSuppliers()
    loadCustomers()
  }, [])

  useEffect(() => {
    if (formData.entity_type === 'supplier') {
      loadSuppliers()
    } else {
      loadCustomers()
    }
    setFormData(prev => ({ ...prev, entity_id: '', retail_contract_id: '', retail_milestone_id: '' }))
    setContracts([])
    setMilestones([])
  }, [formData.entity_type])

  useEffect(() => {
    if (formData.retail_project_id && formData.entity_id) {
      loadContracts()
    } else {
      setContracts([])
      setFormData(prev => ({ ...prev, retail_contract_id: '', retail_milestone_id: '' }))
    }
  }, [formData.retail_project_id, formData.entity_id, formData.entity_type])

  useEffect(() => {
    if (formData.retail_contract_id) {
      loadMilestones()
    } else {
      setMilestones([])
      setFormData(prev => ({ ...prev, retail_milestone_id: '' }))
    }
  }, [formData.retail_contract_id])

  const loadInitialData = async () => {
    try {
      const [companiesRes, projectsRes, categoriesRes] = await Promise.all([
        supabase.from('accounting_companies').select('id, name').order('name'),
        supabase.from('retail_projects').select('id, name, plot_number').order('name'),
        supabase.from('invoice_categories').select('id, name').eq('is_active', true).order('sort_order')
      ])

      if (companiesRes.error) throw companiesRes.error
      if (projectsRes.error) throw projectsRes.error

      setCompanies(companiesRes.data || [])
      setProjects(projectsRes.data || [])
      if (!categoriesRes.error) {
        setInvoiceCategories(categoriesRes.data || [])
      }
    } catch (err) {
      console.error('Error loading initial data:', err)
      setError('Greška pri učitavanju podataka')
    }
  }

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('retail_suppliers')
        .select('id, name, contact_person')
        .order('name')

      if (error) throw error
      setSuppliers(data || [])
    } catch (err) {
      console.error('Error loading suppliers:', err)
    }
  }

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('retail_customers')
        .select('id, name, contact_email')
        .order('name')

      if (error) throw error
      setCustomers(data || [])
    } catch (err) {
      console.error('Error loading customers:', err)
    }
  }

  const loadContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('retail_contracts')
        .select(`
          id,
          contract_number,
          phase_id,
          supplier_id,
          customer_id,
          phases:retail_project_phases!inner(phase_type, phase_name, project_id)
        `)
        .eq('retail_project_phases.project_id', formData.retail_project_id)
        .eq(formData.entity_type === 'supplier' ? 'supplier_id' : 'customer_id', formData.entity_id)
        .order('contract_number')

      if (error) throw error
      setContracts(data || [])
    } catch (err) {
      console.error('Error loading contracts:', err)
      setError('Greška pri učitavanju ugovora')
    }
  }

  const loadMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('retail_contract_milestones')
        .select('id, milestone_number, milestone_name, percentage, status, due_date')
        .eq('contract_id', formData.retail_contract_id)
        .order('milestone_number', { ascending: true })

      if (error) throw error
      setMilestones(data || [])
    } catch (err) {
      console.error('Error loading milestones:', err)
      setError('Greška pri učitavanju milestones')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.company_id) throw new Error('Morate odabrati firmu')
      if (!formData.entity_id) throw new Error('Morate odabrati entitet')
      if (!formData.retail_project_id) throw new Error('Morate odabrati projekt')
      if (!formData.retail_contract_id) throw new Error('Morate odabrati ugovor/fazu')
      if (!formData.invoice_number) throw new Error('Morate unijeti broj računa')
      if (!formData.issue_date) throw new Error('Morate unijeti datum izdavanja')
      if (!formData.due_date) throw new Error('Morate unijeti datum dospijeća')

      if (formData.base_amount_1 === 0 && formData.base_amount_2 === 0 && formData.base_amount_3 === 0 && formData.base_amount_4 === 0) {
        throw new Error('Morate unijeti barem jednu osnovicu')
      }

      const { totalAmount } = calculateVatAndTotal()

      let invoiceType: string
      if (formData.invoice_type === 'incoming' && formData.entity_type === 'supplier') {
        invoiceType = 'INCOMING_SUPPLIER'
      } else if (formData.invoice_type === 'outgoing' && formData.entity_type === 'customer') {
        invoiceType = 'OUTGOING_SALES'
      } else if (formData.invoice_type === 'outgoing' && formData.entity_type === 'supplier') {
        invoiceType = 'OUTGOING_SUPPLIER'
      } else if (formData.invoice_type === 'incoming' && formData.entity_type === 'customer') {
        invoiceType = 'INCOMING_INVESTMENT'
      } else {
        throw new Error('Nevalidna kombinacija tipa računa i entiteta')
      }

      const invoiceData: any = {
        invoice_type: invoiceType,
        company_id: formData.company_id,
        invoice_category: 'RETAIL',
        retail_project_id: formData.retail_project_id,
        retail_contract_id: formData.retail_contract_id,
        retail_milestone_id: formData.retail_milestone_id || null,
        invoice_number: formData.invoice_number,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        base_amount_1: formData.base_amount_1 || 0,
        base_amount_2: formData.base_amount_2 || 0,
        base_amount_3: formData.base_amount_3 || 0,
        base_amount_4: formData.base_amount_4 || 0,
        category: formData.category,
        description: formData.notes || null
      }

      if (formData.entity_type === 'supplier') {
        invoiceData.retail_supplier_id = formData.entity_id
      } else {
        invoiceData.retail_customer_id = formData.entity_id
      }

      const { error: insertError } = await supabase
        .from('accounting_invoices')
        .insert(invoiceData)

      if (insertError) throw insertError

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error creating retail invoice:', err)
      setError(err.message || 'Greška pri kreiranju računa')
    } finally {
      setLoading(false)
    }
  }

  const getEntityOptions = () => {
    if (formData.entity_type === 'supplier') {
      return suppliers.map(s => ({ id: s.id, name: s.name }))
    } else {
      return customers.map(c => ({ id: c.id, name: c.name }))
    }
  }

  const calculateVatAndTotal = () => {
    const base1 = formData.base_amount_1 || 0
    const base2 = formData.base_amount_2 || 0
    const base3 = formData.base_amount_3 || 0
    const base4 = formData.base_amount_4 || 0

    const vat1 = base1 * 0.25
    const vat2 = base2 * 0.13
    const vat3 = 0
    const vat4 = base4 * 0.05

    const totalAmount = (base1 + vat1) + (base2 + vat2) + base3 + (base4 + vat4)

    return {
      vat1,
      vat2,
      vat3,
      vat4,
      subtotal1: base1 + vat1,
      subtotal2: base2 + vat2,
      subtotal3: base3,
      subtotal4: base4 + vat4,
      totalAmount
    }
  }

  const calc = calculateVatAndTotal()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Novi Retail Račun</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

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
                value={formData.base_amount_3}
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

            {(formData.base_amount_1 > 0 || formData.base_amount_2 > 0 || formData.base_amount_3 > 0 || formData.base_amount_4 > 0) && (
              <div className="col-span-2 bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="text-sm font-medium text-gray-700 mb-2">Pregled računa:</div>

                {formData.base_amount_1 > 0 && (
                  <div className="space-y-1 pb-2 border-b border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Osnovica (PDV 25%):</span>
                      <span className="font-medium">€{formData.base_amount_1.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PDV 25%:</span>
                      <span className="font-medium">€{calc.vat1.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>€{calc.subtotal1.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {formData.base_amount_2 > 0 && (
                  <div className="space-y-1 pb-2 border-b border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Osnovica (PDV 13%):</span>
                      <span className="font-medium">€{formData.base_amount_2.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PDV 13%:</span>
                      <span className="font-medium">€{calc.vat2.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>€{calc.subtotal2.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {formData.base_amount_4 > 0 && (
                  <div className="space-y-1 pb-2 border-b border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Osnovica (PDV 5%):</span>
                      <span className="font-medium">€{formData.base_amount_4.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PDV 5%:</span>
                      <span className="font-medium">€{calc.vat4.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>€{calc.subtotal4.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {formData.base_amount_3 > 0 && (
                  <div className="space-y-1 pb-2 border-b border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Osnovica (PDV 0%):</span>
                      <span className="font-medium">€{formData.base_amount_3.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PDV 0%:</span>
                      <span className="font-medium">€0.00</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>€{calc.subtotal3.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-base font-bold pt-2">
                  <span>UKUPNO:</span>
                  <span>€{calc.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ukupno (€)
              </label>
              <input
                type="text"
                value={calc.totalAmount.toFixed(2)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-semibold"
                disabled
                readOnly
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Napomene
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Dodatne napomene..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Kreiranje...' : 'Kreiraj račun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
