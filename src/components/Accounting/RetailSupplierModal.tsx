import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Modal, Button, Input, Select, FormField, Alert } from '../ui'

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
    <Modal show={true} onClose={onClose} size="sm">
      <Modal.Header title="Novi Retail Dobavljač" onClose={onClose} />

      <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 flex flex-col">
        <Modal.Body>
          {error && (
            <Alert variant="error">{error}</Alert>
          )}

          <FormField label="Naziv dobavljača" required>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="npr. Geodetski ured d.o.o."
            />
          </FormField>

          <FormField label="Tip dobavljača" required>
            <Select
              value={formData.supplier_type}
              onChange={(e) => setFormData({ ...formData, supplier_type: e.target.value })}
              required
            >
              {SUPPLIER_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Kontakt osoba">
            <Input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              placeholder="Ime i prezime"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Telefon">
              <Input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="+385 99 ..."
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="info@example.com"
              />
            </FormField>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Poveži sa retail projektom (opcionalno)</h3>

            <div className="space-y-4">
              <FormField label="Retail Projekt">
                <Select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value, phase_id: '' })}
                  disabled={loadingProjects}
                >
                  <option value="">Odaberite retail projekt</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              {formData.project_id && (
                <FormField label="Faza" required>
                  <Select
                    value={formData.phase_id}
                    onChange={(e) => setFormData({ ...formData, phase_id: e.target.value })}
                    required
                  >
                    <option value="">Odaberite fazu</option>
                    {phases.map((phase) => (
                      <option key={phase.id} value={phase.id}>
                        {phase.phase_name} ({phase.phase_type})
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
            </div>
          </div>

          <Alert variant="info">
            <p>
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
          </Alert>
        </Modal.Body>

        <Modal.Footer sticky>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Odustani
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
          >
            {submitting ? 'Spremam...' : 'Dodaj retail dobavljača'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default RetailSupplierModal
