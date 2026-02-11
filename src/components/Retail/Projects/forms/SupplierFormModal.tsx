import React, { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailSupplier, RetailSupplierType } from '../../../../types/retail'
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
    supplier_type_id: supplier?.supplier_type_id || '',
    contact_person: supplier?.contact_person || '',
    notes: supplier?.notes || ''
  })
  const [supplierTypes, setSupplierTypes] = useState<RetailSupplierType[]>([])
  const [showNewTypeInput, setShowNewTypeInput] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSupplierTypes()
  }, [])

  const loadSupplierTypes = async () => {
    try {
      const types = await retailProjectService.fetchSupplierTypes()
      setSupplierTypes(types)
    } catch (err) {
      console.error('Error loading supplier types:', err)
    }
  }

  const handleAddNewType = async () => {
    if (!newTypeName.trim()) {
      setError('Unesite naziv tipa')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const newType = await retailProjectService.createSupplierType(newTypeName.trim())
      setSupplierTypes([...supplierTypes, newType])
      setFormData({ ...formData, supplier_type_id: newType.id })
      setNewTypeName('')
      setShowNewTypeInput(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri kreiranju novog tipa')
      console.error('Error creating supplier type:', err)
    } finally {
      setLoading(false)
    }
  }

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
              <div className="flex gap-2">
                <Select
                  value={formData.supplier_type_id}
                  onChange={(e) => setFormData({ ...formData, supplier_type_id: e.target.value })}
                  required
                  className="flex-1"
                >
                  <option value="">Odaberite tip</option>
                  {supplierTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowNewTypeInput(!showNewTypeInput)}
                  className="px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </FormField>

            {showNewTypeInput && (
              <FormField label="Novi tip dobavljača" className="md:col-span-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="Unesite naziv novog tipa"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleAddNewType}
                    disabled={loading || !newTypeName.trim()}
                  >
                    Dodaj
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowNewTypeInput(false)
                      setNewTypeName('')
                    }}
                    disabled={loading}
                  >
                    Odustani
                  </Button>
                </div>
              </FormField>
            )}

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
