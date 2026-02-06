import React from 'react'
import { Modal, Button, Input, Select, FormField } from '../../ui'
import { SupplierFormData, Project, Phase } from '../types/supplierTypes'

interface SupplierFormModalProps {
  showModal: boolean
  editingSupplier: string | null
  formData: SupplierFormData
  setFormData: React.Dispatch<React.SetStateAction<SupplierFormData>>
  projects: Project[]
  phases: Phase[]
  loadingProjects: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  showModal,
  editingSupplier,
  formData,
  setFormData,
  projects,
  phases,
  loadingProjects,
  onClose,
  onSubmit
}) => {
  return (
    <Modal show={showModal} onClose={onClose} size="sm">
      <Modal.Header
        title={editingSupplier ? 'Uredi dobavljača' : 'Novi dobavljač'}
        onClose={onClose}
      />

      <form onSubmit={onSubmit} className="overflow-y-auto flex-1">
        <div className="p-6 space-y-4">
          <FormField label="Naziv dobavljača" required>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="npr. Elektro servis d.o.o."
            />
          </FormField>

          <FormField label="Kontakt (email ili telefon)" required>
            <Input
              type="text"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              required
              placeholder="info@example.com ili +385 99 123 4567"
            />
          </FormField>

          {!editingSupplier && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Poveži sa projektom (opcionalno)</h3>

              <div className="space-y-4">
                <FormField label="Projekti">
                  <Select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value, phase_id: '' })}
                    disabled={loadingProjects}
                  >
                    <option value="">Odaberite projekt</option>
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
                          {phase.phase_name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Napomena:</strong> Nakon dodavanja dobavljača, možete kreirati račune za njih u sekciji "Računi".
              {!editingSupplier && formData.project_id && formData.phase_id ? (
                <span className="block mt-2">
                  Dobavljač će biti automatski zakačen na odabrani projekt i fazu kao "bez ugovora". Možete vidjeti dobavljača u "Site Management" modulu za taj projekt.
                </span>
              ) : !editingSupplier ? (
                <span className="block mt-2">
                  Za dobavljače s projektima, koristite "Site Management" za kreiranje ugovora.
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            Odustani
          </Button>
          <Button type="submit">
            {editingSupplier ? 'Spremi promjene' : 'Dodaj dobavljača'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default SupplierFormModal
