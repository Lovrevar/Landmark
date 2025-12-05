import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailLandPlot } from '../../../../types/retail'

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
        plot_number: '',
        purchase_price: ''
      })
      return
    }

    const selectedPlot = landPlots.find(plot => plot.id === landPlotId)
    if (selectedPlot) {
      setFormData({
        ...formData,
        land_plot_id: landPlotId,
        location: selectedPlot.location || '',
        plot_number: selectedPlot.plot_number,
        purchase_price: selectedPlot.total_price.toString()
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

  const selectedPlot = landPlots.find(plot => plot.id === formData.land_plot_id)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {project ? 'Uredi projekt' : 'Novi projekt'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Naziv projekta *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zemljište
              </label>
              {loadingLandPlots ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                  Učitavam zemljišta...
                </div>
              ) : (
                <>
                  <select
                    value={formData.land_plot_id}
                    onChange={(e) => handleLandPlotChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Bez zemljišta (ručni unos) --</option>
                    {landPlots.map(plot => (
                      <option key={plot.id} value={plot.id}>
                        {plot.plot_number} - {plot.owner_first_name} {plot.owner_last_name} ({plot.purchased_area_m2} m²)
                      </option>
                    ))}
                  </select>
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
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lokacija *
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={!!formData.land_plot_id}
              />
              {formData.land_plot_id && (
                <p className="mt-1 text-xs text-gray-500">Automatski popunjeno iz odabranog zemljišta</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Broj čestice *
              </label>
              <input
                type="text"
                value={formData.plot_number}
                onChange={(e) => setFormData({ ...formData, plot_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={!!formData.land_plot_id}
              />
              {formData.land_plot_id && (
                <p className="mt-1 text-xs text-gray-500">Automatski popunjeno</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Površina (m²) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.total_area_m2}
                onChange={(e) => setFormData({ ...formData, total_area_m2: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budžet projekta (€) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={!!formData.land_plot_id}
              />
              {formData.land_plot_id && (
                <p className="mt-1 text-xs text-gray-500">Automatski popunjeno (cijena zemljišta)</p>
              )}
              {!formData.land_plot_id && (
                <p className="mt-1 text-xs text-gray-500">Budžet projekta - zvijezda vodilja za potrošnju</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum početka
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum završetka
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Napomene
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Odustani
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Spremam...' : project ? 'Spremi promjene' : 'Kreiraj projekt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
