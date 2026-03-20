import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, FormField, Input, Textarea, Button, Alert } from '../../../ui'
import { createContractType } from '../services/siteService'

interface Props {
  visible: boolean
  onClose: () => void
  onCreated: (newId: number) => void
}

export const ContractTypeFormModal: React.FC<Props> = ({ visible, onClose, onCreated }) => {
  const { t } = useTranslation()
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
    if (!name.trim()) errors.name = t('supervision.contract_type.errors.name_required')
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
        setError(t('supervision.contract_type.errors.already_exists'))
      } else {
        setError(t('supervision.contract_type.errors.save_error'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={visible} onClose={handleClose} size="sm">
      <Modal.Header
        title={t('supervision.contract_type.title')}
        subtitle={t('supervision.contract_type.subtitle')}
        onClose={handleClose}
      />
      <Modal.Body>
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        <FormField label={t('supervision.contract_type.name_label')} required error={fieldErrors.name}>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('supervision.contract_type.name_placeholder')}
            autoFocus
          />
        </FormField>
        <FormField label={t('supervision.contract_type.desc_label')}>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('supervision.contract_type.desc_placeholder')}
            rows={3}
          />
        </FormField>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {t('supervision.contract_type.save')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
