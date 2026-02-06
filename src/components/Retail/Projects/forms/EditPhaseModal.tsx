import React, { useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import type { RetailProjectPhase, RetailProjectWithPhases } from '../../../../types/retail'
import { Button, Modal, FormField, Input, Select, Textarea } from '../../../../components/ui'

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
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title="Uredi Fazu"
        subtitle={phase.phase_type !== 'sales' ? `Dostupan budžet: ${formatCurrency(availableBudget)}` : undefined}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          <FormField label="Naziv Faze">
            <Input
              type="text"
              value={formData.phase_name}
              onChange={(e) => setFormData({ ...formData, phase_name: e.target.value })}
              required
            />
          </FormField>

          {phase.phase_type !== 'sales' && (
            <FormField label="Budžet (EUR)">
              <Input
                type="number"
                value={formData.budget_allocated}
                onChange={(e) => setFormData({ ...formData, budget_allocated: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
                required
              />
              {formData.budget_allocated > availableBudget && (
                <p className="text-xs text-red-600 mt-1">
                  Upozorenje: Prekoračenje dostupnog budžeta za {formatCurrency(formData.budget_allocated - availableBudget)}
                </p>
              )}
            </FormField>
          )}

          <FormField label="Status">
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as RetailProjectPhase['status'] })}
              required
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Datum Početka">
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </FormField>

            <FormField label="Datum Završetka">
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Napomene">
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Dodatne napomene..."
            />
          </FormField>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>
            Odustani
          </Button>
          <Button type="submit" loading={loading}>
            Spremi Promjene
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
