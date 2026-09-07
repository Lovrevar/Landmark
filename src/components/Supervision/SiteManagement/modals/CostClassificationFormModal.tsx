import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, FormField, Input, Textarea, Button, Alert } from '../../../ui'
import { createCostClassification } from '../services/siteService'

interface Props {
  visible: boolean
  onClose: () => void
  onCreated: (newId: number) => void
}

/**
 * Inline creation of a cost classification, reached from the "+" beside the classification
 * select. Mirrors ContractTypeFormModal so the two axes feel identical to use.
 *
 * Only user-defined classifications are created here; the seven seeded ones are system rows and
 * are managed (not created) in ManageCostClassificationsModal.
 */
export const CostClassificationFormModal: React.FC<Props> = ({ visible, onClose, onCreated }) => {
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
    if (!name.trim()) errors.name = t('supervision.cost_classification.errors.name_required')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      setSaving(true)
      setError(null)

      // Sorted after the seeded rows (which use 10..70) unless reordered later.
      const newId = await createCostClassification({
        name: name.trim(),
        description: description.trim() || null,
        sort_order: 100
      })
      onCreated(newId)
      handleClose()
    } catch (err: unknown) {
      console.error('Error creating cost classification:', err)
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        setError(t('supervision.cost_classification.errors.already_exists'))
      } else {
        setError(t('supervision.cost_classification.errors.save_error'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={visible} onClose={handleClose} size="sm">
      <Modal.Header
        title={t('supervision.cost_classification.title_create')}
        subtitle={t('supervision.cost_classification.subtitle')}
        onClose={handleClose}
      />
      <Modal.Body>
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        <FormField label={t('supervision.cost_classification.name_label')} required error={fieldErrors.name}>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('supervision.cost_classification.name_placeholder')}
            autoFocus
          />
        </FormField>
        <FormField label={t('supervision.cost_classification.desc_label')}>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('supervision.cost_classification.desc_placeholder')}
            rows={3}
          />
        </FormField>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {t('supervision.cost_classification.save')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
