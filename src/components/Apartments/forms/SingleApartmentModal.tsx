import React, { useState, useEffect } from 'react'
import { ApartmentFormData } from '../types/apartmentTypes'
import { Modal, FormField, Select, Input, Button } from '../../ui'
import {
  ContractedSection,
  ContractFields,
  emptyContractFields,
  contractFieldsToPayload
} from './ContractedSection'

interface SingleApartmentModalProps {
  visible: boolean
  onClose: () => void
  projects: Array<{ id: string; name: string }>
  buildings: Array<{ id: string; name: string; project_id: string }>
  onSubmit: (data: ApartmentFormData) => void
}

export const SingleApartmentModal: React.FC<SingleApartmentModalProps> = ({
  visible,
  onClose,
  projects,
  buildings,
  onSubmit
}) => {
  const [formData, setFormData] = useState({
    project_id: '',
    building_id: '',
    number: '',
    floor: 1,
    size_m2: 80,
    price: 150000,
    ulaz: '',
    tip_stana: '',
    sobnost: null as number | null,
    povrsina_otvoreno: null as number | null,
    povrsina_ot_sa_koef: null as number | null
  })
  const [contractFields, setContractFields] = useState<ContractFields>(emptyContractFields())

  const filteredBuildings = buildings.filter(b => b.project_id === formData.project_id)

  useEffect(() => {
    if (formData.project_id && filteredBuildings.length > 0) {
      setFormData(prev => ({ ...prev, building_id: filteredBuildings[0].id }))
    }
  }, [formData.project_id])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.project_id || !formData.building_id || !formData.number) {
      alert('Please fill in all required fields')
      return
    }
    onSubmit({ ...formData, ...contractFieldsToPayload(contractFields) })
  }

  if (!visible) return null

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header title="Add Single Apartment" onClose={onClose} />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <Modal.Body>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Project" required>
                <Select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value, building_id: '' })}
                  required
                >
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Building" required>
                <Select
                  value={formData.building_id}
                  onChange={(e) => setFormData({ ...formData, building_id: e.target.value })}
                  required
                  disabled={!formData.project_id}
                >
                  <option value="">Select Building</option>
                  {filteredBuildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Apartment Number (Oznaka stana)" required>
                <Input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="e.g., A101"
                  required
                />
              </FormField>

              <FormField label="Entrance (Ulaz)">
                <Input
                  type="text"
                  value={formData.ulaz || ''}
                  onChange={(e) => setFormData({ ...formData, ulaz: e.target.value })}
                  placeholder="e.g., A, 1, Ulaz 1"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField label="Floor (Etaža)" required>
                <Input
                  type="number"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                  required
                />
              </FormField>

              <FormField label="Apartment Type (Tip stana)">
                <Input
                  type="text"
                  value={formData.tip_stana || ''}
                  onChange={(e) => setFormData({ ...formData, tip_stana: e.target.value })}
                  placeholder="e.g., 2S, 3S+K"
                />
              </FormField>

              <FormField label="Rooms (Sobnost)">
                <Input
                  type="number"
                  value={formData.sobnost ?? ''}
                  onChange={(e) => setFormData({ ...formData, sobnost: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="e.g., 2"
                  min="0"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField label="Saleable Area m² (Stan m2 prodajno)" required>
                <Input
                  type="number"
                  value={formData.size_m2}
                  onChange={(e) => setFormData({ ...formData, size_m2: parseFloat(e.target.value) })}
                  required
                  step="0.01"
                />
              </FormField>

              <FormField label="Open Area m² (Površina otvoreno)">
                <Input
                  type="number"
                  value={formData.povrsina_otvoreno ?? ''}
                  onChange={(e) => setFormData({ ...formData, povrsina_otvoreno: e.target.value ? parseFloat(e.target.value) : null })}
                  step="0.01"
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Open Area w/ Coef. m²">
                <Input
                  type="number"
                  value={formData.povrsina_ot_sa_koef ?? ''}
                  onChange={(e) => setFormData({ ...formData, povrsina_ot_sa_koef: e.target.value ? parseFloat(e.target.value) : null })}
                  step="0.01"
                  placeholder="0.00"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Price (EUR)" required>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  required
                  step="0.01"
                />
              </FormField>
            </div>

            <ContractedSection value={contractFields} onChange={setContractFields} price={formData.price} />
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Create Apartment</Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
