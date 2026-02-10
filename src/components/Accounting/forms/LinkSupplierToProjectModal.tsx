import React, { useState, useEffect } from 'react'
import { Link2 } from 'lucide-react'
import { Modal, FormField, Select, Button, Alert } from '../../ui'
import { supabase } from '../../../lib/supabase'

interface LinkSupplierToProjectModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
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

interface Phase {
  id: string
  phase_name: string
  phase_number: number
  project_id: string
}

export const LinkSupplierToProjectModal: React.FC<LinkSupplierToProjectModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedPhaseId, setSelectedPhaseId] = useState('')

  useEffect(() => {
    if (visible) {
      loadSuppliers()
      loadProjects()
    }
  }, [visible])

  useEffect(() => {
    if (selectedProjectId) {
      loadPhases(selectedProjectId)
    } else {
      setPhases([])
      setSelectedPhaseId('')
    }
  }, [selectedProjectId])

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('subcontractors')
        .select('id, name, contact')
        .order('name')

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error loading suppliers:', error)
      alert('Greška pri učitavanju dobavljača')
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
      alert('Greška pri učitavanju projekata')
    }
  }

  const loadPhases = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_phases')
        .select('id, phase_name, phase_number, project_id')
        .eq('project_id', projectId)
        .order('phase_number')

      if (error) throw error
      setPhases(data || [])
    } catch (error) {
      console.error('Error loading phases:', error)
      alert('Greška pri učitavanju faza')
    }
  }

  const generateUniqueContractNumber = async (projectId: string): Promise<string> => {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single()

    if (projectError) throw projectError

    const { data: contracts, error: contractsError } = await supabase
      .from('contracts')
      .select('contract_number')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (contractsError) throw contractsError

    const projectCode = project.name.substring(0, 3).toUpperCase()
    const nextNumber = contracts && contracts.length > 0
      ? parseInt(contracts[0].contract_number.split('-').pop() || '0') + 1
      : 1

    return `${projectCode}-${String(nextNumber).padStart(4, '0')}`
  }

  const handleSubmit = async () => {
    if (!selectedSupplierId || !selectedProjectId || !selectedPhaseId) {
      alert('Molimo odaberite dobavljača, projekt i fazu')
      return
    }

    try {
      setSubmitting(true)

      const contractNumber = await generateUniqueContractNumber(selectedProjectId)

      const { error } = await supabase
        .from('contracts')
        .insert({
          contract_number: contractNumber,
          project_id: selectedProjectId,
          phase_id: selectedPhaseId,
          subcontractor_id: selectedSupplierId,
          job_description: 'Povezan iz Accountinga',
          contract_amount: 0,
          base_amount: 0,
          vat_rate: 0,
          vat_amount: 0,
          total_amount: 0,
          budget_realized: 0,
          status: 'active',
          has_contract: false,
          contract_type_id: null,
          end_date: null
        })

      if (error) throw error

      alert('Dobavljač uspješno povezan!')
      resetForm()
      onSuccess()
    } catch (error) {
      console.error('Error linking supplier:', error)
      alert('Greška pri povezivanju dobavljača')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSelectedSupplierId('')
    setSelectedProjectId('')
    setSelectedPhaseId('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!visible) return null

  return (
    <Modal show={visible} onClose={handleClose} size="md">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Link2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Poveži Dobavljača</h2>
            <p className="text-gray-600 text-sm">Dodaj postojećeg dobavljača u fazu projekta</p>
          </div>
        </div>

        <Alert variant="info" className="mb-6">
          Dobavljač će biti dodan u odabranu fazu bez ugovora (has_contract = false)
        </Alert>

        <div className="space-y-4">
          <FormField label="Dobavljač" required>
            <Select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              disabled={loading}
            >
              <option value="">Odaberi dobavljača</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} - {supplier.contact}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Projekt" required>
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">Odaberi projekt</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Faza" required>
            <Select
              value={selectedPhaseId}
              onChange={(e) => setSelectedPhaseId(e.target.value)}
              disabled={!selectedProjectId}
            >
              <option value="">Odaberi fazu</option>
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  Faza {phase.phase_number}: {phase.phase_name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
          <Button variant="ghost" onClick={handleClose}>
            Odustani
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || !selectedSupplierId || !selectedProjectId || !selectedPhaseId}
          >
            {submitting ? 'Povezivanje...' : 'Poveži'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
