import React, { useState, useEffect } from 'react'
import { ApartmentFormData } from '../types'
import { Modal, FormField, Select, Input, Button, Form } from '../../../ui'
import {
  ContractedSection,
  ContractFields,
  emptyContractFields,
  contractFieldsToPayload
} from '../ContractedSection'

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const filteredBuildings = buildings.filter(b => b.project_id === formData.project_id)

  useEffect(() => {
    if (formData.project_id && filteredBuildings.length > 0) {
      setFormData(prev => ({ ...prev, building_id: filteredBuildings[0].id }))
    }
  }, [formData.project_id])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!formData.project_id) errors.project_id = 'Project is required'
    if (!formData.building_id) errors.building_id = 'Building is required'
    if (!formData.number) errors.number = 'Apartment number is required'
    if (!formData.floor && formData.floor !== 0) errors.floor = 'Floor is required'
    if (!formData.size_m2) errors.size_m2 = 'Saleable area is required'
    if (!formData.price) errors.price = 'Price is required'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSubmit({ ...formData, ...contractFieldsToPayload(contractFields) })
  }

  if (!visible) return null

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header title="Add Single Apartment" onClose={onClose} />

      <Form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <Modal.Body>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Project" required error={fieldErrors.project_id}>
                <Select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value, building_id: '' })}
                >
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Building" required error={fieldErrors.building_id}>
                <Select
                  value={formData.building_id}
                  onChange={(e) => setFormData({ ...formData, building_id: e.target.value })}
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
              <FormField label="Apartment Number (Oznaka stana)" required error={fieldErrors.number}>
                <Input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="e.g., A101"
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
              <FormField label="Floor (Etaža)" required error={fieldErrors.floor}>
                <Input
                  type="number"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
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
              <FormField label="Saleable Area m² (Stan m2 prodajno)" required error={fieldErrors.size_m2}>
                <Input
                  type="number"
                  value={formData.size_m2}
                  onChange={(e) => setFormData({ ...formData, size_m2: parseFloat(e.target.value) })}
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
              <FormField label="Price (EUR)" required error={fieldErrors.price}>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
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
      </Form>
    </Modal>
  )
}
