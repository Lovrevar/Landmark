import React from 'react'
import { X } from 'lucide-react'
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
  if (!showModal) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {editingSupplier ? 'Uredi dobavljača' : 'Novi dobavljač'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Naziv dobavljača *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                placeholder="npr. Elektro servis d.o.o."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontakt (email ili telefon) *
              </label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                placeholder="info@example.com ili +385 99 123 4567"
              />
            </div>

            {!editingSupplier && (
              <>
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Poveži sa projektom (opcionalno)</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Projekti
                      </label>
                      <select
                        value={formData.project_id}
                        onChange={(e) => setFormData({ ...formData, project_id: e.target.value, phase_id: '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={loadingProjects}
                      >
                        <option value="">Odaberite projekt</option>
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Odaberite fazu</option>
                          {phases.map((phase) => (
                            <option key={phase.id} value={phase.id}>
                              {phase.phase_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </>
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

          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Odustani
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              {editingSupplier ? 'Spremi promjene' : 'Dodaj dobavljača'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SupplierFormModal
