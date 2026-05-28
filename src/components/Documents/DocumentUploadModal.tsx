import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { Modal, Button, FormField, Textarea } from '../ui'
import { useToast } from '../../contexts/ToastContext'

import { uploadDocument, fetchCategories } from './services/documentService'
import type {
  AssociationInput,
  DocumentCategory,
  DocumentCategoryNode,
  DocumentWithRelations,
  EntityType,
} from './types'
import { flattenTree } from './utils/treeHelpers'
import { FilePickerField } from './components/FilePickerField'
import { CategoryTree } from './components/CategoryTree'
import { EntityPicker } from './components/EntityPicker'

type LockableField =
  | 'category'
  | 'project'
  | 'subcontractor'
  | 'contract'
  | 'unit'
  | 'customer'
  | 'credit'

type PickerEntity = Exclude<LockableField, 'category'>

const PICKER_TYPES: PickerEntity[] = [
  'project', 'subcontractor', 'contract', 'unit', 'customer', 'credit',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_FILE_SIZE_MB = 50
const MAX_DESCRIPTION = 500

const EMPTY_ASSOCS: AssociationInput[] = []

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  // Fires once per submit with every successfully uploaded document. The same
  // metadata (category, associations, description) is applied to every file.
  onUploaded?: (documents: DocumentWithRelations[]) => void
  defaultCategoryId?: string | null
  defaultAssociations?: AssociationInput[]
  lockedFields?: LockableField[]
  title?: string
}

const initialPickerState = (): Record<PickerEntity, string | null> => ({
  project: null, subcontractor: null, contract: null,
  unit: null, customer: null, credit: null,
})

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onUploaded,
  defaultCategoryId,
  defaultAssociations,
  lockedFields,
  title,
}) => {
  const { t } = useTranslation()
  const toast = useToast()

  const [files, setFiles] = useState<File[]>([])
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [pickerValues, setPickerValues] = useState<Record<PickerEntity, string | null>>(
    initialPickerState,
  )
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [categories, setCategories] = useState<DocumentCategoryNode[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const flatCategories = useMemo(() => flattenTree(categories), [categories])
  const categoryById = useMemo(
    () => new Map(flatCategories.map(c => [c.id, c])),
    [flatCategories],
  )

  const lockedSet = useMemo<Set<LockableField>>(
    () => new Set(lockedFields ?? []),
    [lockedFields],
  )

  const defaultAssocs = defaultAssociations ?? EMPTY_ASSOCS
  const defaultAssocByType = useMemo(() => {
    const m: Partial<Record<EntityType, string>> = {}
    for (const a of defaultAssocs) m[a.entityType] = a.entityId
    return m
  }, [defaultAssocs])

  // Reset state when the modal opens. Only fires on the open transition;
  // mid-open changes to defaults are intentionally ignored so user input survives.
  useEffect(() => {
    if (!isOpen) return
    setFiles([])
    setCategoryId(defaultCategoryId ?? null)
    const init = initialPickerState()
    for (const a of defaultAssocs) {
      if ((PICKER_TYPES as readonly string[]).includes(a.entityType)) {
        init[a.entityType as PickerEntity] = a.entityId
      }
    }
    setPickerValues(init)
    setDescription('')
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Load category tree on open. Toast/t reads happen inside the catch handler so
  // they do not need to be in the dep array (and would cause spurious refetches).
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setCategoriesLoading(true)
    fetchCategories()
      .then(tree => { if (!cancelled) setCategories(tree) })
      .catch(() => {
        if (!cancelled) toast.error(t('documents.upload_modal.toast.error_generic'))
      })
      .finally(() => { if (!cancelled) setCategoriesLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Auto-expand ancestors of the selected category.
  useEffect(() => {
    if (!categoryId || flatCategories.length === 0) return
    const ancestors = new Set<string>()
    let cur = categoryById.get(categoryId)
    while (cur?.parent_id) {
      ancestors.add(cur.parent_id)
      cur = categoryById.get(cur.parent_id)
    }
    if (ancestors.size === 0) return
    setExpandedIds(prev => {
      const next = new Set(prev)
      let changed = false
      ancestors.forEach(id => { if (!next.has(id)) { next.add(id); changed = true } })
      return changed ? next : prev
    })
  }, [categoryId, flatCategories, categoryById])

  const selectedCategory = categoryId ? categoryById.get(categoryId) ?? null : null

  const breadcrumb = useMemo(() => {
    if (!selectedCategory) return ''
    const parts: string[] = []
    let cur: DocumentCategory | undefined = selectedCategory
    while (cur) {
      parts.unshift(cur.name_hr)
      cur = cur.parent_id ? categoryById.get(cur.parent_id) : undefined
    }
    return parts.join(' › ')
  }, [selectedCategory, categoryById])

  const requiredAssocs = selectedCategory?.required_associations ?? []
  const pathStartsWith = (prefix: string) => {
    const p = selectedCategory?.path ?? ''
    return p === prefix || p.startsWith(`${prefix}/`)
  }

  // Land purchase contracts are filed under PRAVNO/KUPOPRODAJNI_UGOVORI and
  // their counterparty (the seller) is stored as a subcontractor record — so
  // the subcontractor picker surfaces here as a "seller" picker.
  const isLandPurchaseContext = pathStartsWith('PRAVNO/KUPOPRODAJNI_UGOVORI')

  const isPickerVisible = (type: PickerEntity): boolean => {
    if (lockedSet.has(type)) return true
    if (requiredAssocs.includes(type)) return true
    if (defaultAssocByType[type]) return true
    // Project is offered for any selected category, optionally — covers FINANCIJE
    // where project isn't required but the user may still want to tag one.
    if (type === 'project')       return !!selectedCategory
    if (type === 'unit' || type === 'customer') return pathStartsWith('PRODAJA')
    if (type === 'credit')        return pathStartsWith('FINANCIJE')
    if (type === 'subcontractor') return isLandPurchaseContext
    if (type === 'contract')      return !!pickerValues.subcontractor
    return false
  }

  const clearError = (key: string) =>
    setErrors(prev => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })

  const handleSubmit = async () => {
    const errs: Record<string, string> = {}
    if (files.length === 0) {
      errs.file = t('documents.upload_modal.errors.file_required')
    } else {
      const oversized = files.find(f => f.size > MAX_FILE_SIZE)
      if (oversized) {
        errs.file = t('documents.upload_modal.errors.file_too_large_named', {
          name: oversized.name,
          limit: MAX_FILE_SIZE_MB,
        })
      }
    }
    if (!categoryId) errs.category = t('documents.upload_modal.errors.category_required')

    for (const r of requiredAssocs) {
      const fromPicker = (PICKER_TYPES as readonly string[]).includes(r)
        ? pickerValues[r as PickerEntity]
        : null
      const fromDefault = defaultAssocByType[r] ?? null
      if (!fromPicker && !fromDefault) {
        errs[r] = t('documents.upload_modal.errors.field_required')
      }
    }

    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    if (files.length === 0 || !categoryId) return // type-narrow

    // Combine picker values + defaults, dedup on (type, id).
    const seen = new Set<string>()
    const finalAssocs: AssociationInput[] = []
    const add = (entityType: EntityType, entityId: string | null) => {
      if (!entityId) return
      const key = `${entityType}:${entityId}`
      if (seen.has(key)) return
      seen.add(key)
      finalAssocs.push({ entityType, entityId })
    }
    // Only include picker values for types currently visible — prevents stale
    // selections from a previous category (e.g. a credit picked under FINANCIJE
    // before the user switched to a different branch) from leaking through.
    for (const type of PICKER_TYPES) {
      if (isPickerVisible(type)) add(type, pickerValues[type])
    }
    for (const a of defaultAssocs) add(a.entityType, a.entityId)

    setSubmitting(true)
    // Sequential, fail-fast — matches the existing siteService multi-upload
    // pattern. If a file mid-batch fails, earlier files stay committed; the
    // modal stays open so the user can decide how to recover.
    const uploaded: DocumentWithRelations[] = []
    try {
      for (const f of files) {
        const result = await uploadDocument(f, {
          categoryId,
          associations: finalAssocs,
          description: description.trim() || null,
        })
        uploaded.push(result)
      }
      toast.success(
        files.length > 1
          ? t('documents.upload_modal.toast.success_many', { count: files.length })
          : t('documents.upload_modal.toast.success'),
      )
      onUploaded?.(uploaded)
      onClose()
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : t('documents.upload_modal.toast.error_generic')
      toast.error(msg)
      // Surface partial-success on a mid-batch failure so the user knows what
      // already committed and can adjust the file list before retrying.
      if (uploaded.length > 0) {
        onUploaded?.(uploaded)
        setFiles(prev => prev.filter(f => !uploaded.some(u => u.file_name === f.name && u.file_size === f.size)))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const modalTitle = title ?? t('documents.upload_modal.title')
  const categoryLocked = lockedSet.has('category')

  return (
    <Modal show={isOpen} onClose={handleClose} size="lg">
      <Modal.Header title={modalTitle} onClose={handleClose} />
      <Modal.Body>
        <FilePickerField
          files={files}
          onChange={(next) => { setFiles(next); clearError('file') }}
          error={errors.file}
          disabled={submitting}
        />

        <FormField
          label={t('documents.upload_modal.category_label')}
          required
          error={errors.category}
        >
          {breadcrumb && (
            <div className="text-sm text-gray-700 dark:text-gray-300 mb-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded">
              {breadcrumb}
            </div>
          )}
          {!categoryLocked && (
            categoriesLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('documents.upload_modal.category_loading')}</span>
              </div>
            ) : (
              <CategoryTree
                nodes={categories}
                selectedId={categoryId}
                expandedIds={expandedIds}
                onToggle={(id) => setExpandedIds(prev => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })}
                onSelect={(id) => { setCategoryId(id); clearError('category') }}
              />
            )
          )}
        </FormField>

        {PICKER_TYPES.map(type => {
          if (!isPickerVisible(type)) return null
          // In the land-purchase context the subcontractor picker is presented as
          // a "seller" (Prodavatelj) — same underlying entity, different label.
          const sellerMode = type === 'subcontractor' && isLandPurchaseContext
          return (
            <EntityPicker
              key={type}
              entityType={type}
              value={pickerValues[type] ?? null}
              onChange={(v) => {
                setPickerValues(prev => {
                  const next = { ...prev, [type]: v }
                  // Either project or subcontractor change invalidates the
                  // contract list — the previously chosen contract may not
                  // belong to the new (project, subcontractor) scope.
                  if (type === 'subcontractor' || type === 'project') next.contract = null
                  return next
                })
                clearError(type)
              }}
              disabled={lockedSet.has(type) || submitting}
              required={requiredAssocs.includes(type)}
              error={errors[type]}
              scopeSubcontractorId={type === 'contract' ? pickerValues.subcontractor : undefined}
              scopeProjectId={type === 'contract' ? pickerValues.project : undefined}
              label={sellerMode ? t('documents.upload_modal.seller_label') : undefined}
              placeholder={sellerMode ? t('documents.upload_modal.seller_placeholder') : undefined}
            />
          )
        })}

        <FormField
          label={t('documents.upload_modal.description_label')}
          helperText={t('documents.upload_modal.char_counter', {
            count: description.length, max: MAX_DESCRIPTION,
          })}
        >
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
            maxLength={MAX_DESCRIPTION}
            rows={3}
            placeholder={t('documents.upload_modal.description_placeholder')}
            disabled={submitting}
          />
        </FormField>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={submitting}>
          {t('documents.upload_modal.cancel')}
        </Button>
        <Button onClick={handleSubmit} loading={submitting}>
          {submitting
            ? t('documents.upload_modal.uploading')
            : t('documents.upload_modal.submit')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
