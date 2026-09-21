import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FormField } from '../../ui'
import SearchableSelect, { type SearchableOption } from '../../ui/SearchableSelect'
import InlineLoadError from '../../ui/InlineLoadError'
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
  // The fetch used to fall back to `[]`, so a failure looked exactly like "nothing to choose
  // from" — and on a required picker it blocked the upload with no explanation at all.
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true)
    try {
      const opts = await fetchEntityOptions(entityType, {
        subcontractorId: scopeSubcontractorId ?? null,
        projectId: scopeProjectId ?? null,
      })
      if (signal?.cancelled) return
      setOptions(opts)
      setLoadError(false)
    } catch (e) {
      if (signal?.cancelled) return
      console.error(`Failed to load ${entityType} options`, e)
      setOptions([])
      setLoadError(true)
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }, [entityType, scopeSubcontractorId, scopeProjectId])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load])

  const labelText = label ?? t(`documents.upload_modal.${entityType}_label`)
  const placeholderText = loading
    ? t('documents.upload_modal.loading')
    : (placeholder ?? t(`documents.upload_modal.${entityType}_placeholder`))

  // A chosen value the list can no longer name still belongs in the control — the upload will
  // be saved with it, so the field must not read as empty.
  const shownOptions: SearchableOption[] =
    loadError && value && !options.some(o => o.value === value)
      ? [...options, { value, label: t('common.option_name_unavailable') }]
      : options

  return (
    <FormField label={labelText} required={required} error={error}>
      <SearchableSelect
        value={value}
        options={shownOptions}
        onChange={onChange}
        disabled={disabled || loading || loadError}
        placeholder={placeholderText}
        searchPlaceholder={t('documents.upload_modal.search_placeholder')}
        allowClear={!required && !disabled}
      />
      {loadError && (
        <InlineLoadError
          className="mt-1"
          message={t('documents.upload_modal.options_load_error')}
          onRetry={() => { void load() }}
        />
      )}
    </FormField>
  )
}
