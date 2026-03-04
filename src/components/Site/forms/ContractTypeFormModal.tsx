import React, { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Modal, FormField, Input, Textarea, Button, Alert } from '../../ui'

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

  const handleClose = () => {
    setName('')
    setDescription('')
    setError(null)
    onClose()
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Naziv kategorije je obavezan')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const { data: existingTypes } = await supabase
        .from('contract_types')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)

      const newId = (existingTypes && existingTypes.length > 0 ? existingTypes[0].id : 0) + 1

      const { error: insertError } = await supabase
        .from('contract_types')
        .insert({ id: newId, name: name.trim(), description: description.trim() || null, is_active: true })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Kategorija s tim nazivom već postoji')
        } else {
          throw insertError
        }
        return
      }

      onCreated(newId)
      handleClose()
    } catch (err) {
      console.error('Error creating category:', err)
      setError('Greška pri spremanju kategorije')
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
        <FormField label="Naziv kategorije" required>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="npr. Elektrika, Građevinski radovi..."
            required
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
