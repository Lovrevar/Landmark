import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface RetailProject {
  id: string
  name: string
}

interface RetailPhase {
  id: string
  phase_name: string
  phase_type: string
}

interface RetailSupplierModalProps {
  onClose: () => void
  onSuccess: () => void
}

const SUPPLIER_TYPES = ['Geodet', 'Arhitekt', 'Projektant', 'Consultant', 'Other'] as const

const RetailSupplierModal: React.FC<RetailSupplierModalProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    supplier_type: 'Other' as string,
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    project_id: '',
    phase_id: ''
  })
  const [projects, setProjects] = useState<RetailProject[]>([])
  const [phases, setPhases] = useState<RetailPhase[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    loadRetailProjects()
    return () => { document.body.style.overflow = 'unset' }
  }, [])

  useEffect(() => {
    if (formData.project_id) {
      loadRetailPhases(formData.project_id)
    } else {
      setPhases([])
    }
  }, [formData.project_id])

  const loadRetailProjects = async () => {
    try {
      setLoadingProjects(true)
      const { data, error } = await supabase
        .from('retail_projects')
        .select('id, name')
        .order('name')

      if (error) throw error
      setProjects(data || [])
    } catch (err) {
      console.error('Error loading retail projects:', err)
    } finally {
      setLoadingProjects(false)
    }
  }

  const loadRetailPhases = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('retail_project_phases')
        .select('id, phase_name, phase_type')
        .eq('project_id', projectId)
        .order('phase_order')

      if (error) throw error
      setPhases(data || [])
    } catch (err) {
      console.error('Error loading retail phases:', err)
      setPhases([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (formData.project_id && !formData.phase_id) {
      setError('Molimo odaberite fazu za odabrani projekt')
      return
    }

    try {
      setSubmitting(true)

      const { data: newSupplier, error: supplierError } = await supabase
        .from('retail_suppliers')
        .insert([{
          name: formData.name,
          supplier_type: formData.supplier_type,
          contact_person: formData.contact_person || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null
        }])
        .select()
        .single()

      if (supplierError) throw supplierError

      if (formData.project_id && formData.phase_id && newSupplier) {
        const year = new Date().getFullYear()
        const timestamp = Date.now().toString().slice(-6)
        const contractNumber = `RCN-${year}-${timestamp}`

        const { error: contractError } = await supabase
          .from('retail_contracts')
          .insert([{
            contract_number: contractNumber,
            phase_id: formData.phase_id,
            supplier_id: newSupplier.id,
            contract_amount: 0,
            budget_realized: 0,
            status: 'Active'
          }])

        if (contractError) throw contractError
      }

      onSuccess()
    } catch (err: any) {
      console.error('Error saving retail supplier:', err)
      if (err?.code === '23505') {
        setError('Dobavljac s tim podacima vec postoji. Pokušajte ponovo.')
      } else {
        setError(err?.message || 'Greška prilikom spremanja dobavljača')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Novi Retail Dobavljač</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Naziv dobavljača *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
                placeholder="npr. Geodetski ured d.o.o."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tip dobavljača *
              </label>
              <select
                value={formData.supplier_type}
                onChange={(e) => setFormData({ ...formData, supplier_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                {SUPPLIER_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontakt osoba
              </label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Ime i prezime"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="+385 99 ..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="info@example.com"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Poveži sa retail projektom (opcionalno)</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Retail Projekt
                  </label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value, phase_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    disabled={loadingProjects}
                  >
                    <option value="">Odaberite retail projekt</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.project_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Faza *
                    </label>
                    <select
                      value={formData.phase_id}
                      onChange={(e) => setFormData({ ...formData, phase_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberite fazu</option>
                      {phases.map((phase) => (
                        <option key={phase.id} value={phase.id}>
                          {phase.phase_name} ({phase.phase_type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <p className="text-sm text-teal-800">
                <strong>Napomena:</strong> Retail dobavljač će biti kreiran u retail sustavu.
                {formData.project_id && formData.phase_id ? (
                  <span className="block mt-2">
                    Dobavljač će biti automatski povezan s odabranim retail projektom i fazom.
                    Možete ga vidjeti u "Retail Projekti" modulu.
                  </span>
                ) : (
                  <span className="block mt-2">
                    Možete naknadno povezati dobavljača s retail projektom u "Retail Projekti" modulu.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              disabled={submitting}
            >
              Odustani
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Spremam...' : 'Dodaj retail dobavljača'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RetailSupplierModal
