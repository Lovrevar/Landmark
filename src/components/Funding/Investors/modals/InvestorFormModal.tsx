import React from 'react'
import { Modal, FormField, Input, Button } from '../../../ui'
import type { Bank } from '../../../../lib/supabase'
import type { BankFormData } from '../types'

interface InvestorFormModalProps {
  show: boolean
  onClose: () => void
  editingBank: Bank | null
  formData: BankFormData
  onChange: (data: BankFormData) => void
  onSubmit: () => void
}

const InvestorFormModal: React.FC<InvestorFormModalProps> = ({
  show,
  onClose,
  editingBank,
  formData,
  onChange,
  onSubmit,
}) => {
  return (
    <Modal show={show} onClose={onClose} size="md">
      <Modal.Header title={editingBank ? 'Edit Bank' : 'Add New Bank'} onClose={onClose} />
      <Modal.Body>
        <div className="space-y-4">
          <FormField label="Bank Name" required>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              placeholder="Enter bank name"
            />
          </FormField>
          <FormField label="Contact Person">
            <Input
              type="text"
              value={formData.contact_person}
              onChange={(e) => onChange({ ...formData, contact_person: e.target.value })}
              placeholder="Enter contact person name"
            />
          </FormField>
          <FormField label="Contact Email">
            <Input
              type="email"
              value={formData.contact_email}
              onChange={(e) => onChange({ ...formData, contact_email: e.target.value })}
              placeholder="Enter contact email"
            />
          </FormField>
          <FormField label="Contact Phone">
            <Input
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => onChange({ ...formData, contact_phone: e.target.value })}
              placeholder="Enter contact phone"
            />
          </FormField>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit}>
          {editingBank ? 'Update' : 'Add'} Bank
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default InvestorFormModal
