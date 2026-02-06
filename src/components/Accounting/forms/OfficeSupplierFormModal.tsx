import React from 'react'
import { Modal, Button, Input, FormField } from '../../ui'
import { OfficeSupplier, OfficeSupplierFormData } from '../types/officeSupplierTypes'

interface OfficeSupplierFormModalProps {
  showModal: boolean
  editingSupplier: OfficeSupplier | null
  formData: OfficeSupplierFormData
  setFormData: (data: OfficeSupplierFormData) => void
  handleCloseModal: () => void
  handleSubmit: (e: React.FormEvent) => void
}

const OfficeSupplierFormModal: React.FC<OfficeSupplierFormModalProps> = ({
  showModal,
  editingSupplier,
  formData,
  setFormData,
  handleCloseModal,
  handleSubmit
}) => {
  return (
    <Modal show={showModal} onClose={handleCloseModal} size="md">
      <Modal.Header
        title={editingSupplier ? 'Uredi office dobavljača' : 'Novi office dobavljač'}
        onClose={handleCloseModal}
      />

      <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
        <div className="p-6 space-y-4">
          <FormField label="Naziv dobavljača" required>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="npr. HR Servis d.o.o."
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Kontakt (telefon)">
              <Input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="+385 99 123 4567"
              />
            </FormField>

            <FormField label="Email">
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@example.com"
              />
            </FormField>
          </div>

          <FormField label="Adresa">
            <Input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ulica 123, Zagreb"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="OIB">
              <Input
                type="text"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="12345678901"
              />
            </FormField>

            <FormField label="PDV ID">
              <Input
                type="text"
                value={formData.vat_id}
                onChange={(e) => setFormData({ ...formData, vat_id: e.target.value })}
                placeholder="HR12345678901"
              />
            </FormField>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Napomena:</strong> Office dobavljači se koriste za uredske troškove kao što su plaće,
              lizinzi automobila, najam ureda, režije i slično. Ne prikazuju se u projektnim računima.
            </p>
          </div>
        </div>

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={handleCloseModal}>
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

export default OfficeSupplierFormModal
