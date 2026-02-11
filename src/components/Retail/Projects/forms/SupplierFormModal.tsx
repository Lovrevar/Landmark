import React, { useState } from 'react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailSupplier } from '../../../../types/retail'
import { Button, Modal, FormField, Input, Select, Textarea } from '../../../../components/ui'

interface SupplierFormModalProps {
  onClose: () => void
  onSuccess: () => void
  supplier?: RetailSupplier
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  onClose,
  onSuccess,
  supplier
}) => {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    supplier_type: supplier?.supplier_type || 'Other',
    contact_person: supplier?.contact_person || '',
    notes: supplier?.notes || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const dataToSubmit = {
        ...formData,
        contact_person: formData.contact_person || null,
        contact_phone: null,
        contact_email: null,
        oib: null,
        address: null,
        notes: formData.notes || null
      }

      if (supplier) {
        await retailProjectService.updateSupplier(supplier.id, dataToSubmit)
      } else {
        await retailProjectService.createSupplier(dataToSubmit)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri spremanju dobavljača')
      console.error('Error saving supplier:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header title={supplier ? 'Uredi dobavljača' : 'Novi dobavljač'} onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Naziv dobavljača" required className="md:col-span-2">
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Tip dobavljača" required>
              <Select
                value={formData.supplier_type}
                onChange={(e) => setFormData({ ...formData, supplier_type: e.target.value as any })}
                required
              >
                <option value="Geodet">Geodet</option>
                <option value="Arhitekt">Arhitekt</option>
                <option value="Projektant">Projektant</option>
                <option value="Consultant">Consultant</option>
                <option value="Other">Other</option>
              </Select>
            </FormField>

            <FormField label="Kontakt osoba">
              <Input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
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
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Odustani
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
          >
            {supplier ? 'Spremi promjene' : 'Kreiraj dobavljača'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
