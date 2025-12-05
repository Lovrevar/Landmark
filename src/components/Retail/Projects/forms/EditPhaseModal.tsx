import React, { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import type { RetailProjectPhase, RetailProjectWithPhases } from '../../../../types/retail'

interface EditPhaseModalProps {
  phase: RetailProjectPhase
  project: RetailProjectWithPhases
  onClose: () => void
  onSuccess: () => void
}

export const EditPhaseModal: React.FC<EditPhaseModalProps> = ({
  phase,
  project,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    phase_name: phase.phase_name,
    budget_allocated: phase.budget_allocated,
    status: phase.status,
    start_date: phase.start_date || '',
    end_date: phase.end_date || '',
    notes: phase.notes || ''
  })
  const [loading, setLoading] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('retail_project_phases')
        .update({
          phase_name: formData.phase_name,
          budget_allocated: formData.budget_allocated,
          status: formData.status,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          notes: formData.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', phase.id)

      if (error) throw error

      onSuccess()
    } catch (error) {
      console.error('Error updating phase:', error)
      alert('Greška pri ažuriranju faze')
    } finally {
      setLoading(false)
    }
  }

  const otherPhasesTotal = project.phases
    .filter(p => p.id !== phase.id)
    .reduce((sum, p) => sum + p.budget_allocated, 0)

  const availableBudget = project.purchase_price - otherPhasesTotal

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Uredi Fazu</h3>
              {phase.phase_type !== 'sales' && (
                <p className="text-sm text-gray-600 mt-1">
                  Dostupan budžet: {formatCurrency(availableBudget)}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Naziv Faze
            </label>
            <input
              type="text"
              value={formData.phase_name}
              onChange={(e) => setFormData({ ...formData, phase_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {phase.phase_type !== 'sales' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budžet (EUR)
              </label>
              <input
                type="number"
                value={formData.budget_allocated}
                onChange={(e) => setFormData({ ...formData, budget_allocated: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="0.01"
                required
              />
              {formData.budget_allocated > availableBudget && (
                <p className="text-xs text-red-600 mt-1">
                  Upozorenje: Prekoračenje dostupnog budžeta za {formatCurrency(formData.budget_allocated - availableBudget)}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as RetailProjectPhase['status'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Datum Početka
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Datum Završetka
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Napomene
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Dodatne napomene..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Spremam...' : 'Spremi Promjene'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
