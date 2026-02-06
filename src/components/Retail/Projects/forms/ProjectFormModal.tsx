import React, { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailLandPlot } from '../../../../types/retail'
import { Button, Modal, FormField, Input, Select, Textarea, ConfirmDialog } from '../../../../components/ui'

interface ProjectFormModalProps {
  onClose: () => void
  onSuccess: () => void
  project?: any
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  onClose,
  onSuccess,
  project
}) => {
  const [formData, setFormData] = useState({
    land_plot_id: project?.land_plot_id || '',
    name: project?.name || '',
    location: project?.location || '',
    plot_number: project?.plot_number || '',
    total_area_m2: project?.total_area_m2 || '',
    purchase_price: project?.purchase_price || '',
    status: project?.status || 'Planning',
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
    notes: project?.notes || ''
  })
  const [landPlots, setLandPlots] = useState<RetailLandPlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingLandPlots, setLoadingLandPlots] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadLandPlots()
  }, [])

  const loadLandPlots = async () => {
    try {
      setLoadingLandPlots(true)
      const plots = await retailProjectService.fetchLandPlots()
      setLandPlots(plots)
    } catch (err) {
      console.error('Error loading land plots:', err)
    } finally {
      setLoadingLandPlots(false)
    }
  }

  const handleLandPlotChange = (landPlotId: string) => {
    if (landPlotId === '') {
      setFormData({
        ...formData,
        land_plot_id: '',
        location: '',
        plot_number: ''
      })
      return
    }

    const selectedPlot = landPlots.find(plot => plot.id === landPlotId)
    if (selectedPlot) {
      setFormData({
        ...formData,
        land_plot_id: landPlotId,
        location: selectedPlot.location || '',
        plot_number: selectedPlot.plot_number
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const dataToSubmit = {
        ...formData,
        land_plot_id: formData.land_plot_id || null,
        total_area_m2: parseFloat(formData.total_area_m2 as any),
        purchase_price: parseFloat(formData.purchase_price as any),
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        notes: formData.notes || null
      }

      if (project) {
        await retailProjectService.updateProject(project.id, dataToSubmit)
      } else {
        const newProject = await retailProjectService.createProject(dataToSubmit)
        await retailProjectService.createDefaultPhases(newProject.id)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri spremanju projekta')
      console.error('Error saving project:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!project) return

    setDeleting(true)
    setError(null)

    try {
      await retailProjectService.deleteProject(project.id)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri brisanju projekta')
      console.error('Error deleting project:', err)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const selectedPlot = landPlots.find(plot => plot.id === formData.land_plot_id)

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header title={project ? 'Uredi projekt' : 'Novi projekt'} onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Naziv projekta" required className="md:col-span-2">
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Zemljište">
                {loadingLandPlots ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    Učitavam zemljišta...
                  </div>
                ) : (
                  <>
                    <Select
                      value={formData.land_plot_id}
                      onChange={(e) => handleLandPlotChange(e.target.value)}
                    >
                      <option value="">-- Bez zemljišta (ručni unos) --</option>
                      {landPlots.map(plot => (
                        <option key={plot.id} value={plot.id}>
                          {plot.plot_number} - {plot.owner_first_name} {plot.owner_last_name} ({plot.purchased_area_m2} m²)
                        </option>
                      ))}
                    </Select>
                    {selectedPlot && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        <div className="font-medium text-blue-900 mb-1">Info o zemljištu:</div>
                        <div className="text-blue-800 space-y-1">
                          <div>Vlasnik: {selectedPlot.owner_first_name} {selectedPlot.owner_last_name}</div>
                          <div>Ukupna površina: {selectedPlot.total_area_m2} m²</div>
                          <div>Kupljena površina: {selectedPlot.purchased_area_m2} m²</div>
                          <div>Cijena po m²: €{selectedPlot.price_per_m2.toFixed(2)}</div>
                          <div>Ukupna cijena: €{selectedPlot.total_price.toFixed(2)}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </FormField>
            </div>

            <FormField
              label="Lokacija"
              required
              helperText={formData.land_plot_id ? 'Automatski popunjeno iz odabranog zemljišta' : undefined}
              className="md:col-span-2"
            >
              <Input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                disabled={!!formData.land_plot_id}
              />
            </FormField>

            <FormField
              label="Broj čestice"
              required
              helperText={formData.land_plot_id ? 'Automatski popunjeno' : undefined}
            >
              <Input
                type="text"
                value={formData.plot_number}
                onChange={(e) => setFormData({ ...formData, plot_number: e.target.value })}
                required
                disabled={!!formData.land_plot_id}
              />
            </FormField>

            <FormField label="Status">
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </Select>
            </FormField>

            <FormField label="Površina (m²)" required>
              <Input
                type="number"
                step="0.01"
                value={formData.total_area_m2}
                onChange={(e) => setFormData({ ...formData, total_area_m2: e.target.value })}
                required
              />
            </FormField>

            <FormField
              label="Budžet projekta (€)"
              required
              helperText={selectedPlot
                ? `Cijena zemljišta: €${selectedPlot.total_price.toLocaleString('hr-HR')}`
                : 'Budžet projekta'
              }
            >
              <Input
                type="number"
                step="0.01"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Datum početka">
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </FormField>

            <FormField label="Datum završetka">
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </FormField>

            <FormField label="Napomene" className="md:col-span-2">
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </FormField>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <div className="flex justify-between items-center w-full">
            <div>
              {project && (
                <Button
                  type="button"
                  variant="outline-danger"
                  icon={Trash2}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading || deleting}
                >
                  Obriši projekt
                </Button>
              )}
            </div>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={loading || deleting}
              >
                Odustani
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={loading || deleting}
              >
                {project ? 'Spremi promjene' : 'Kreiraj projekt'}
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </form>

      <ConfirmDialog
        show={showDeleteConfirm}
        title="Potvrda brisanja"
        message={
          <>
            Jeste li sigurni da želite obrisati projekt "<strong>{project?.name}</strong>"?
            <br /><br />
            Ova akcija će obrisati projekt i sve povezane podatke (faze, ugovore, milestones). Ova akcija se ne može poništiti.
          </>
        }
        confirmLabel={deleting ? 'Brišem...' : 'Da, obriši'}
        cancelLabel="Odustani"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />
    </Modal>
  )
}
