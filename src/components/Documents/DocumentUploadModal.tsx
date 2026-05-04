import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, X, FileText, ChevronRight, Loader2 } from 'lucide-react'

import { Modal, Button, FormField, Textarea } from '../ui'
import SearchableSelect, { type SearchableOption } from '../ui/SearchableSelect'
import { useToast } from '../../contexts/ToastContext'
import { formatFileSize } from '../../utils/formatters'
import { supabase } from '../../lib/supabase'

import { uploadDocument, fetchCategories } from './services/documentService'
import type {
  AssociationInput,
  DocumentCategory,
  DocumentCategoryNode,
  DocumentWithRelations,
  EntityType,
} from './types'

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

function flattenTree(nodes: DocumentCategoryNode[]): DocumentCategory[] {
  const out: DocumentCategory[] = []
  const visit = (n: DocumentCategoryNode) => {
    const { children, ...rest } = n
    out.push(rest)
    children.forEach(visit)
  }
  nodes.forEach(visit)
  return out
}

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

// ===========================================================================
// File picker — multi-file, drag-drop or click, any mime, 50MB cap per file
// ===========================================================================

interface FilePickerFieldProps {
  files: File[]
  onChange: (files: File[]) => void
  error?: string
  disabled?: boolean
}

const FilePickerField: React.FC<FilePickerFieldProps> = ({ files, onChange, error, disabled }) => {
  const { t } = useTranslation()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draggingOver, setDraggingOver] = useState(false)

  const handleSelect = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return

    const accepted: File[] = []
    const rejected: string[] = []
    Array.from(selected).forEach(f => {
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(f.name)
        return
      }
      // Skip duplicates by (name, size) — covers re-picking the same file and
      // re-dropping a batch the user already added.
      const dupe =
        files.some(x => x.name === f.name && x.size === f.size) ||
        accepted.some(x => x.name === f.name && x.size === f.size)
      if (!dupe) accepted.push(f)
    })

    if (rejected.length > 0) {
      // One toast per rejected name keeps the message readable when the user
      // drops a mixed batch of small + huge files.
      rejected.forEach(name => {
        toast.error(t('documents.upload_modal.errors.file_too_large_named', {
          name, limit: MAX_FILE_SIZE_MB,
        }))
      })
    }
    if (accepted.length > 0) {
      onChange([...files, ...accepted])
    }
    // Reset the native input so re-picking the exact same file still triggers onChange.
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeAt = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <FormField
      label={t('documents.upload_modal.file_label')}
      required
      error={error}
    >
      <div
        onDrop={(e) => {
          e.preventDefault()
          setDraggingOver(false)
          if (!disabled) handleSelect(e.dataTransfer.files)
        }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDraggingOver(true) }}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDraggingOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDraggingOver(false) }}
        onClick={() => { if (!disabled) inputRef.current?.click() }}
        className={[
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          disabled
            ? 'opacity-60 cursor-not-allowed border-gray-300 dark:border-gray-600'
            : draggingOver
              ? 'cursor-pointer border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
              : 'cursor-pointer border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleSelect(e.target.files)}
        />
        <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('documents.upload_modal.drag_or_click')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t('documents.upload_modal.any_type_hint')}
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {t('documents.upload_modal.selected_count', { count: files.length })}
          </p>
          {files.map((f, i) => (
            <div
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{f.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(f.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeAt(i) }}
                disabled={disabled}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0 disabled:opacity-50"
                title={t('documents.upload_modal.remove_file')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </FormField>
  )
}

// ===========================================================================
// Category tree — collapsible, indented, name_hr labels
// ===========================================================================

interface CategoryTreeProps {
  nodes: DocumentCategoryNode[]
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}

const CategoryTree: React.FC<CategoryTreeProps> = ({
  nodes, selectedId, expandedIds, onSelect, onToggle,
}) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto bg-white dark:bg-gray-800">
    {nodes.map(node => (
      <CategoryTreeNode
        key={node.id}
        node={node}
        depth={0}
        selectedId={selectedId}
        expandedIds={expandedIds}
        onSelect={onSelect}
        onToggle={onToggle}
      />
    ))}
  </div>
)

interface CategoryTreeNodeProps {
  node: DocumentCategoryNode
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}

const CategoryTreeNode: React.FC<CategoryTreeNodeProps> = ({
  node, depth, selectedId, expandedIds, onSelect, onToggle,
}) => {
  const expanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  // Row click selects, and also expands collapsed parents (never collapses).
  // The chevron is the dedicated collapse-only control.
  const handleRowClick = () => {
    onSelect(node.id)
    if (hasChildren && !expanded) onToggle(node.id)
  }

  return (
    <>
      <div
        onClick={handleRowClick}
        className={[
          'flex items-center gap-1 px-2 py-1.5 cursor-pointer text-sm select-none',
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(node.id) }}
            className="flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="truncate">{node.name_hr}</span>
      </div>
      {expanded && node.children.map(child => (
        <CategoryTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </>
  )
}

// ===========================================================================
// Entity picker — generic SearchableSelect over one of six entity tables
// ===========================================================================

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

const EntityPicker: React.FC<EntityPickerProps> = ({
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

interface EntityScope {
  subcontractorId?: string | null
  projectId?: string | null
}

async function fetchEntityOptions(
  type: PickerEntity,
  scope: EntityScope = {},
): Promise<SearchableOption[]> {
  switch (type) {
    case 'project': {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []).map(r => ({ value: r.id as string, label: r.name as string }))
    }
    case 'subcontractor': {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('id, name, contact')
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []).map(r => ({
        value: r.id as string,
        label: r.name as string,
        sublabel: (r.contact as string | null) ?? undefined,
      }))
    }
    case 'contract': {
      let q = supabase
        .from('contracts')
        .select('id, contract_number, job_description, subcontractor_id, project_id')
        .order('start_date', { ascending: false })
      if (scope.subcontractorId) q = q.eq('subcontractor_id', scope.subcontractorId)
      if (scope.projectId)       q = q.eq('project_id',       scope.projectId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map(r => {
        const num = r.contract_number as string | null
        const desc = r.job_description as string | null
        const idStr = r.id as string
        const label = num || desc?.slice(0, 60) || idStr.slice(0, 8)
        const sublabel = num && desc ? desc.slice(0, 80) : undefined
        return { value: idStr, label, sublabel }
      })
    }
    case 'unit': {
      const { data, error } = await supabase
        .from('apartments')
        .select('id, number, floor')
        .order('number', { ascending: true })
      if (error) throw error
      return (data ?? []).map(r => ({
        value: r.id as string,
        label: String(r.number),
      }))
    }
    case 'customer': {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, surname, customer_number')
        .order('surname', { ascending: true })
      if (error) throw error
      return (data ?? []).map(r => ({
        value: r.id as string,
        label: `${r.name as string} ${r.surname as string}`.trim(),
        sublabel: r.customer_number != null ? `#${r.customer_number}` : undefined,
      }))
    }
    case 'credit': {
      const { data, error } = await supabase
        .from('bank_credits')
        .select('id, credit_type, purpose')
        .order('start_date', { ascending: false })
      if (error) throw error
      return (data ?? []).map(r => ({
        value: r.id as string,
        label: (r.credit_type as string | null) ?? (r.id as string).slice(0, 8),
        sublabel: (r.purpose as string | null) || undefined,
      }))
    }
  }
}
