import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, AlertCircle } from 'lucide-react'

interface Company {
  id: string
  name: string
}

interface Supplier {
  id: string
  name: string
  contact: string
}

interface Project {
  id: string
  name: string
}

interface Contract {
  id: string
  job_description: string
  contract_amount: number
  phase_name: string
  project_name: string
}

interface SupplierInvoiceFormProps {
  onClose: () => void
  onSuccess: () => void
  editingInvoice?: any
}

const SupplierInvoiceForm: React.FC<SupplierInvoiceFormProps> = ({
  onClose,
  onSuccess,
  editingInvoice
}) => {
  const [companies, setCompanies] = useState<Company[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])

  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedContractId, setSelectedContractId] = useState('')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)

  const [formData, setFormData] = useState({
    invoice_type: 'INCOMING_SUPPLIER',
    company_id: '',
    invoice_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    base_amount: 0,
    vat_rate: 25,
    category: 'Materials',
    description: ''
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedSupplierId) {
      fetchSupplierProjects(selectedSupplierId)
    } else {
      setProjects([])
      setContracts([])
      setSelectedProjectId('')
      setSelectedContractId('')
    }
  }, [selectedSupplierId])

  useEffect(() => {
    if (selectedSupplierId && selectedProjectId && selectedProjectId !== 'none') {
      fetchSupplierContracts(selectedSupplierId, selectedProjectId)
    } else {
      setContracts([])
      setSelectedContractId('')
    }
  }, [selectedSupplierId, selectedProjectId])

  useEffect(() => {
    if (selectedContractId) {
      const contract = contracts.find(c => c.id === selectedContractId)
      setSelectedContract(contract || null)
    } else {
      setSelectedContract(null)
    }
  }, [selectedContractId, contracts])

  const fetchInitialData = async () => {
    try {
      const { data: companiesData } = await supabase
        .from('accounting_companies')
        .select('id, name')
        .order('name')

      const { data: suppliersData } = await supabase
        .from('subcontractors')
        .select('id, name, contact')
        .order('name')

      setCompanies(companiesData || [])
      setSuppliers(suppliersData || [])
    } catch (err) {
      console.error('Error fetching initial data:', err)
    }
  }

  const fetchSupplierProjects = async (supplierId: string) => {
    try {
      const { data } = await supabase
        .from('contracts')
        .select(`
          project_id,
          project:projects!contracts_project_id_fkey(id, name)
        `)
        .eq('subcontractor_id', supplierId)
        .eq('status', 'active')

      const uniqueProjects = Array.from(
        new Map(
          (data || [])
            .filter(c => c.project)
            .map(c => [c.project.id, c.project])
        ).values()
      )

      setProjects(uniqueProjects as Project[])
    } catch (err) {
      console.error('Error fetching supplier projects:', err)
    }
  }

  const fetchSupplierContracts = async (supplierId: string, projectId: string) => {
    try {
      const { data } = await supabase
        .from('contracts')
        .select(`
          id,
          job_description,
          contract_amount,
          phase:project_phases!contracts_phase_id_fkey(phase_name),
          project:projects!contracts_project_id_fkey(name)
        `)
        .eq('subcontractor_id', supplierId)
        .eq('project_id', projectId)
        .eq('status', 'active')

      const contractsList = (data || []).map(c => ({
        id: c.id,
        job_description: c.job_description || '',
        contract_amount: parseFloat(c.contract_amount || 0),
        phase_name: c.phase?.phase_name || 'N/A',
        project_name: c.project?.name || ''
      }))

      setContracts(contractsList)
    } catch (err) {
      console.error('Error fetching contracts:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.company_id) {
      setError('Morate odabrati firmu')
      return
    }

    if (!selectedSupplierId) {
      setError('Morate odabrati dobavljača')
      return
    }

    if (!formData.invoice_number) {
      setError('Morate unijeti broj računa')
      return
    }

    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const vat_amount = (formData.base_amount * formData.vat_rate) / 100
      const total_amount = formData.base_amount + vat_amount

      const invoiceData = {
        invoice_type: formData.invoice_type,
        company_id: formData.company_id,
        supplier_id: selectedSupplierId,
        invoice_number: formData.invoice_number,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        base_amount: formData.base_amount,
        vat_rate: formData.vat_rate,
        vat_amount,
        total_amount,
        category: formData.category,
        project_id: selectedProjectId !== 'none' ? selectedProjectId : null,
        contract_id: selectedContractId || null,
        description: formData.description,
        status: 'UNPAID',
        paid_amount: 0,
        remaining_amount: total_amount,
        invoice_category: 'SUBCONTRACTOR',
        created_by: user?.id
      }

      const { error: insertError } = await supabase
        .from('accounting_invoices')
        .insert(invoiceData)

      if (insertError) throw insertError

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error creating invoice:', err)
      setError(err.message || 'Greška pri kreiranju računa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Novi ulazni račun (Dobavljač)
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Firma *
              </label>
              <select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Odaberi firmu</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dobavljač (Subcontractor) *
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Odaberi dobavljača</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSupplierId && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Projekt
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Odaberi projekt</option>
                  <option value="none">🔹 Bez projekta (generalni račun)</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Prikazani su samo projekti gdje ovaj dobavljač ima ugovor
                </p>
              </div>

              {selectedProjectId && selectedProjectId !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ugovor / Faza
                  </label>
                  <select
                    value={selectedContractId}
                    onChange={(e) => setSelectedContractId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Odaberi ugovor</option>
                    {contracts.map(contract => (
                      <option key={contract.id} value={contract.id}>
                        {contract.phase_name} - {contract.job_description}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {selectedContract && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                Informacije o ugovoru
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-blue-700">Projekt:</span>
                  <span className="text-blue-900 font-medium ml-2">
                    {selectedContract.project_name}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Faza:</span>
                  <span className="text-blue-900 font-medium ml-2">
                    {selectedContract.phase_name}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-blue-700">Posao:</span>
                  <span className="text-blue-900 font-medium ml-2">
                    {selectedContract.job_description}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Vrijednost ugovora:</span>
                  <span className="text-blue-900 font-medium ml-2">
                    €{selectedContract.contract_amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Broj računa *
              </label>
              <input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategorija *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="Materials">Materijali</option>
                <option value="Labor">Radna snaga</option>
                <option value="Equipment">Oprema</option>
                <option value="Services">Usluge</option>
                <option value="Other">Ostalo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Datum dospijeća *
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Osnovica (bez PDV) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.base_amount}
                onChange={(e) => setFormData({ ...formData, base_amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDV stopa (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.vat_rate}
                onChange={(e) => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">PDV iznos:</span>
              <span className="font-medium text-gray-900">
                €{((formData.base_amount * formData.vat_rate) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold mt-2 pt-2 border-t border-gray-300">
              <span className="text-gray-900">Ukupno:</span>
              <span className="text-blue-600">
                €{(formData.base_amount + (formData.base_amount * formData.vat_rate) / 100).toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Opis / Napomena
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Dodatne informacije o računu..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={submitting}
            >
              Odustani
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Spremam...' : 'Kreiraj račun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SupplierInvoiceForm
