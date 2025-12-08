import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X } from 'lucide-react'

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
      const [companiesRes, projectsRes] = await Promise.all([
        supabase.from('accounting_companies').select('id, name').order('name'),
        supabase.from('retail_projects').select('id, name, plot_number').order('name')
      ])

      if (companiesRes.error) throw companiesRes.error
      if (projectsRes.error) throw projectsRes.error

      setCompanies(companiesRes.data || [])
      setProjects(projectsRes.data || [])
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
      if (!formData.due_date) throw new Error('Morate unijeti datum dospeća')
      if (!formData.base_amount) throw new Error('Morate unijeti osnovicu')

      const baseAmount = parseFloat(formData.base_amount)
      const vatRate = parseFloat(formData.vat_rate)
      const vatAmount = (baseAmount * vatRate) / 100
      const totalAmount = baseAmount + vatAmount

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
        base_amount: baseAmount,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        paid_amount: 0,
        remaining_amount: totalAmount,
        status: 'UNPAID',
        category: 'RETAIL',
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
    const baseAmount = parseFloat(formData.base_amount) || 0
    const vatRate = parseFloat(formData.vat_rate) || 0
    const vatAmount = (baseAmount * vatRate) / 100
    const totalAmount = baseAmount + vatAmount
    return { vatAmount, totalAmount }
  }

  const { vatAmount, totalAmount } = calculateVatAndTotal()

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
              <input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum dospeća *
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Osnovica (€) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.base_amount}
                onChange={(e) => setFormData({ ...formData, base_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="npr. 10000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDV stopa *
              </label>
              <select
                value={formData.vat_rate}
                onChange={(e) => setFormData({ ...formData, vat_rate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="0">0%</option>
                <option value="13">13%</option>
                <option value="25">25%</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDV iznos (€)
              </label>
              <input
                type="text"
                value={vatAmount.toFixed(2)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                disabled
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ukupno (€)
              </label>
              <input
                type="text"
                value={totalAmount.toFixed(2)}
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
