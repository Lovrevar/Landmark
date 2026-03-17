import React, { useState } from 'react'
import { Modal, FormField, Input, Textarea, Button, Alert } from '../../../ui'
import { createContractType } from '../Services/siteService'

interface Props {
  visible: boolean
  onClose: () => void
  onCreated: (newId: number) => void
}

export const ContractTypeFormModal: React.FC<Props> = ({ visible, onClose, onCreated }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleClose = () => {
    setName('')
    setDescription('')
    setError(null)
    setFieldErrors({})
    onClose()
  }

  const handleSave = async () => {
    const errors: Record<string, string> = {}
    if (!name.trim()) errors.name = 'Naziv kategorije je obavezan'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      setSaving(true)
      setError(null)

      const newId = await createContractType(name.trim(), description.trim() || null)
      onCreated(newId)
      handleClose()
    } catch (err: unknown) {
      console.error('Error creating category:', err)
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        setError('Kategorija s tim nazivom već postoji')
      } else {
        setError('Greška pri spremanju kategorije')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={visible} onClose={handleClose} size="sm">
      <Modal.Header
        title="Nova kategorija ugovora"
        subtitle="Dodajte novu kategoriju koja će biti dostupna za sve buduće ugovore"
        onClose={handleClose}
      />
      <Modal.Body>
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        <FormField label="Naziv kategorije" required error={fieldErrors.name}>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="npr. Elektrika, Građevinski radovi..."
            autoFocus
          />
        </FormField>
        <FormField label="Opis (opcionalno)">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dodajte kratki opis kategorije..."
            rows={3}
          />
        </FormField>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={saving}>
          Odustani
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Spremi kategoriju
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
