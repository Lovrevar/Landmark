import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FormField } from '../../ui'
import SearchableSelect, { type SearchableOption } from '../../ui/SearchableSelect'
import { fetchEntityOptions, type PickerEntity } from '../services/documentOptionsService'

interface EntityPickerProps {
  entityType: PickerEntity
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
  required?: boolean
  error?: string
  scopeSubcontractorId?: string | null
  scopeProjectId?: string | null
  label?: string
  placeholder?: string
}

export const EntityPicker: React.FC<EntityPickerProps> = ({
  entityType, value, onChange, disabled, required, error,
  scopeSubcontractorId, scopeProjectId, label, placeholder,
}) => {
  const { t } = useTranslation()
  const [options, setOptions] = useState<SearchableOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchEntityOptions(entityType, {
      subcontractorId: scopeSubcontractorId ?? null,
      projectId: scopeProjectId ?? null,
    })
      .then(opts => { if (!cancelled) setOptions(opts) })
      .catch(() => { if (!cancelled) setOptions([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [entityType, scopeSubcontractorId, scopeProjectId])

  const labelText = label ?? t(`documents.upload_modal.${entityType}_label`)
  const placeholderText = loading
    ? t('documents.upload_modal.loading')
    : (placeholder ?? t(`documents.upload_modal.${entityType}_placeholder`))

  return (
    <FormField label={labelText} required={required} error={error}>
      <SearchableSelect
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled || loading}
        placeholder={placeholderText}
        searchPlaceholder={t('documents.upload_modal.search_placeholder')}
        allowClear={!required && !disabled}
      />
    </FormField>
  )
}
