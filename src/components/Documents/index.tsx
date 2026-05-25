import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Files, Plus, Search, ExternalLink, Trash2, Loader2, ChevronRight, Folder,
} from 'lucide-react'
import { format } from 'date-fns'

import {
  PageHeader, Button, Table, Badge, EmptyState, LoadingSpinner, ConfirmDialog, Pagination,
} from '../ui'
import SearchableSelect, { type SearchableOption } from '../ui/SearchableSelect'
import { useToast } from '../../contexts/ToastContext'
import { formatFileSize } from '../../utils/formatters'
import { supabase } from '../../lib/supabase'

import {
  fetchCategories, fetchCategoryCounts, fetchDocuments, getDocumentSignedUrl, deleteDocument,
} from './services/documentService'
import type {
  DocumentAssociation,
  DocumentCategory,
  DocumentCategoryNode,
  DocumentFilters,
  DocumentWithRelations,
  EntityType,
} from './types'
import { DocumentUploadModal } from './DocumentUploadModal'

const SEARCH_DEBOUNCE_MS = 600
const PAGE_SIZE = 100

export default function DocumentsPage() {
  const { t } = useTranslation()
  const toast = useToast()

  const [categoryTree, setCategoryTree] = useState<DocumentCategoryNode[]>([])
  const [categoryById, setCategoryById] = useState<Map<string, DocumentCategory>>(new Map())
  const [descendantsById, setDescendantsById] = useState<Map<string, string[]>>(new Map())
  const [categoryCounts, setCategoryCounts] = useState<Map<string, number>>(new Map())
  const [sidebarTotalCount, setSidebarTotalCount] = useState(0)
  const [listTotalCount, setListTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [subcontractorId, setSubcontractorId] = useState<string | null>(null)
  const [uploadedFrom, setUploadedFrom] = useState('')
  const [uploadedTo, setUploadedTo] = useState('')

  const [projectOptions, setProjectOptions] = useState<SearchableOption[]>([])
  const [subcontractorOptions, setSubcontractorOptions] = useState<SearchableOption[]>([])
  const [phaseOptions, setPhaseOptions] = useState<SearchableOption[]>([])
  const [contractOptions, setContractOptions] = useState<SearchableOption[]>([])
  const [creditOptions, setCreditOptions] = useState<SearchableOption[]>([])

  const [documents, setDocuments] = useState<DocumentWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DocumentWithRelations | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)

  // ---- Initial load ------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchCategories(),
      fetchCategoryCounts(),
      fetchProjectOptions(),
      fetchSubcontractorOptions(),
      fetchPhaseOptions(),
      fetchContractOptions(),
      fetchCreditOptions(),
    ])
      .then(([tree, counts, projects, subs, phases, contracts, credits]) => {
        if (cancelled) return
        setCategoryTree(tree)
        setCategoryById(buildIdMap(tree))
        setDescendantsById(buildDescendantsMap(tree))
        setCategoryCounts(rollupCounts(tree, counts.byCategoryId))
        setSidebarTotalCount(counts.total)
        setProjectOptions(projects)
        setSubcontractorOptions(subs)
        setPhaseOptions(phases)
        setContractOptions(contracts)
        setCreditOptions(credits)
      })
      .catch(() => {
        if (!cancelled) toast.error(t('documents.page.toast.load_error'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Debounced search --------------------------------------------------

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [search])

  // ---- List fetch on filter change --------------------------------------

  const filterParams: DocumentFilters = useMemo(() => {
    const categoryIds = selectedCategoryId
      ? descendantsById.get(selectedCategoryId) ?? [selectedCategoryId]
      : undefined
    return {
      ...(categoryIds && { categoryIds }),
      ...(projectId && { projectId }),
      ...(subcontractorId && { entityType: 'subcontractor' as EntityType, entityId: subcontractorId }),
      ...(debouncedSearch.trim() && { fileNameSearch: debouncedSearch.trim() }),
      ...(uploadedFrom && { uploadedFrom: `${uploadedFrom}T00:00:00.000Z` }),
      ...(uploadedTo   && { uploadedTo:   `${uploadedTo}T23:59:59.999Z` }),
    }
  }, [selectedCategoryId, descendantsById, projectId, subcontractorId, debouncedSearch, uploadedFrom, uploadedTo])

  // Reset to page 1 whenever any filter changes (the underlying result set shifts).
  useEffect(() => {
    setCurrentPage(1)
  }, [filterParams])

  useEffect(() => {
    if (loading) return // wait for initial load
    let cancelled = false
    setListLoading(true)
    fetchDocuments(filterParams, { offset: (currentPage - 1) * PAGE_SIZE, limit: PAGE_SIZE })
      .then(({ documents, totalCount }) => {
        if (cancelled) return
        setDocuments(documents)
        setListTotalCount(totalCount)
      })
      .catch(() => { if (!cancelled) toast.error(t('documents.page.toast.load_error')) })
      .finally(() => { if (!cancelled) setListLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParams, currentPage, loading])

  // ---- Mutation refresh --------------------------------------------------

  const refreshCounts = async () => {
    try {
      const counts = await fetchCategoryCounts()
      setCategoryCounts(rollupCounts(categoryTree, counts.byCategoryId))
      setSidebarTotalCount(counts.total)
    } catch {
      // count refresh is best-effort; the list refresh below is the source of truth
    }
  }

  const refreshList = async () => {
    setListLoading(true)
    try {
      const result = await fetchDocuments(filterParams, {
        offset: (currentPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      setDocuments(result.documents)
      setListTotalCount(result.totalCount)
    } catch {
      toast.error(t('documents.page.toast.load_error'))
    } finally {
      setListLoading(false)
    }
  }

  const handleUploaded = async () => {
    setUploadOpen(false)
    await Promise.all([refreshList(), refreshCounts()])
  }

  // ---- Per-row actions ---------------------------------------------------

  const handleOpen = async (doc: DocumentWithRelations) => {
    try {
      setOpeningId(doc.id)
      const url = await getDocumentSignedUrl(doc.file_path, doc.source)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error(t('documents.page.toast.open_error'))
    } finally {
      setOpeningId(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteDocument(pendingDelete.id)
      toast.success(t('documents.page.toast.delete_success'))
      setPendingDelete(null)
      await Promise.all([refreshList(), refreshCounts()])
    } catch {
      toast.error(t('documents.page.toast.delete_error'))
    } finally {
      setDeleting(false)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setProjectId(null)
    setSubcontractorId(null)
    setUploadedFrom('')
    setUploadedTo('')
  }

  const hasActiveFilters =
    !!debouncedSearch.trim() || !!projectId || !!subcontractorId || !!uploadedFrom || !!uploadedTo

  // ---- Category tree helpers --------------------------------------------

  const toggleExpanded = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const breadcrumbFor = (cat: DocumentCategory | null): string => {
    if (!cat) return ''
    const parts: string[] = []
    let cur: DocumentCategory | undefined = cat
    while (cur) {
      parts.unshift(cur.name_hr)
      cur = cur.parent_id ? categoryById.get(cur.parent_id) : undefined
    }
    return parts.join(' › ')
  }

  // ---- Render -----------------------------------------------------------

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('documents.page.title')}
        description={t('documents.page.subtitle')}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setUploadOpen(true)}>
            {t('documents.page.upload')}
          </Button>
        }
      />

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left column — category tree */}
        <aside className="w-full lg:w-80 lg:flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-2">
            {t('documents.page.categories_header')}
          </h2>

          <button
            type="button"
            onClick={() => setSelectedCategoryId(null)}
            className={[
              'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition-colors',
              selectedCategoryId === null
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            <span className="flex items-center gap-2">
              <Folder className="w-4 h-4" />
              {t('documents.page.all_documents')}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{sidebarTotalCount}</span>
          </button>

          <div className="mt-1">
            {categoryTree.map(node => (
              <CategoryRow
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedCategoryId}
                expandedIds={expandedIds}
                counts={categoryCounts}
                onSelect={setSelectedCategoryId}
                onToggle={toggleExpanded}
              />
            ))}
          </div>
        </aside>

        {/* Right column — filters + list */}
        <section className="flex-1 min-w-0 space-y-4">
          {/* Filter bar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('documents.page.search_placeholder')}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <SearchableSelect
                value={projectId}
                options={projectOptions}
                onChange={setProjectId}
                placeholder={t('documents.page.project_filter_placeholder')}
                searchPlaceholder={t('documents.upload_modal.search_placeholder')}
                size="sm"
              />
              <SearchableSelect
                value={subcontractorId}
                options={subcontractorOptions}
                onChange={setSubcontractorId}
                placeholder={t('documents.page.subcontractor_filter_placeholder')}
                searchPlaceholder={t('documents.upload_modal.search_placeholder')}
                size="sm"
              />
              <input
                type="date"
                value={uploadedFrom}
                onChange={e => setUploadedFrom(e.target.value)}
                aria-label={t('documents.page.uploaded_from')}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={uploadedTo}
                onChange={e => setUploadedTo(e.target.value)}
                aria-label={t('documents.page.uploaded_to')}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  {t('documents.page.clear_filters')}
                </Button>
              </div>
            )}
          </div>

          {/* List */}
          <DocumentListTable
            documents={documents}
            loading={listLoading}
            openingId={openingId}
            categoryById={categoryById}
            projectOptions={projectOptions}
            subcontractorOptions={subcontractorOptions}
            phaseOptions={phaseOptions}
            contractOptions={contractOptions}
            creditOptions={creditOptions}
            breadcrumbFor={breadcrumbFor}
            onOpen={handleOpen}
            onDelete={(doc) => setPendingDelete(doc)}
          />

          <Pagination
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            totalCount={listTotalCount}
            onPageChange={setCurrentPage}
            itemLabel={t('documents.page.pagination.item_label')}
          />
        </section>
      </div>

      <DocumentUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />

      <ConfirmDialog
        show={!!pendingDelete}
        title={t('documents.page.delete_confirm_title')}
        message={
          pendingDelete
            ? t('documents.page.delete_confirm_message', { name: pendingDelete.file_name })
            : ''
        }
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// ===========================================================================
// Category tree row
// ===========================================================================

interface CategoryRowProps {
  node: DocumentCategoryNode
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  counts: Map<string, number>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}

const CategoryRow: React.FC<CategoryRowProps> = ({
  node, depth, selectedId, expandedIds, counts, onSelect, onToggle,
}) => {
  const expanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const isSelected = node.id === selectedId
  const count = counts.get(node.id) ?? 0

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
          'flex items-center gap-1 pr-2 py-1.5 rounded text-sm cursor-pointer transition-colors select-none',
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
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
        <span className="flex-1 truncate">{node.name_hr}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{count}</span>
      </div>
      {expanded && node.children.map(child => (
        <CategoryRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          counts={counts}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </>
  )
}

// ===========================================================================
// Document list table
// ===========================================================================

interface DocumentListTableProps {
  documents: DocumentWithRelations[]
  loading: boolean
  openingId: string | null
  categoryById: Map<string, DocumentCategory>
  projectOptions: SearchableOption[]
  subcontractorOptions: SearchableOption[]
  phaseOptions: SearchableOption[]
  contractOptions: SearchableOption[]
  creditOptions: SearchableOption[]
  breadcrumbFor: (cat: DocumentCategory | null) => string
  onOpen: (doc: DocumentWithRelations) => void
  onDelete: (doc: DocumentWithRelations) => void
}

const DocumentListTable: React.FC<DocumentListTableProps> = ({
  documents, loading, openingId, categoryById,
  projectOptions, subcontractorOptions, phaseOptions,
  contractOptions, creditOptions,
  breadcrumbFor, onOpen, onDelete,
}) => {
  const { t } = useTranslation()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const lookups = {
    project: projectOptions,
    subcontractor: subcontractorOptions,
    phase: phaseOptions,
    contract: contractOptions,
    credit: creditOptions,
  }

  const renderBadge = (a: DocumentAssociation) => (
    <Badge key={a.id} variant={badgeVariantForType(a.entity_type)} size="sm">
      <span className="font-normal opacity-70 mr-1">
        {t(`documents.page.entity_label.${a.entity_type}`)}:
      </span>
      {resolveEntityLabel(a, lookups)}
    </Badge>
  )

  if (loading && documents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 py-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <EmptyState
          icon={Files}
          title={t('documents.page.empty.title')}
          description={t('documents.page.empty.description')}
        />
      </div>
    )
  }

  return (
    <div className={loading ? 'opacity-60 transition-opacity' : ''}>
      <Table>
        <Table.Head>
          <tr>
            <Table.Th>
              <span className="sr-only">{t('documents.page.table.expand')}</span>
            </Table.Th>
            <Table.Th>{t('documents.page.table.filename')}</Table.Th>
            <Table.Th>{t('documents.page.table.category')}</Table.Th>
            <Table.Th>{t('documents.page.table.project')}</Table.Th>
            <Table.Th>{t('documents.page.table.uploaded_at')}</Table.Th>
            <Table.Th sticky>{t('documents.page.table.actions')}</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {documents.map(doc => {
            const expanded = expandedIds.has(doc.id)
            const cat = doc.category_id ? categoryById.get(doc.category_id) ?? null : null
            const projects = doc.associations.filter(a => a.entity_type === 'project')
            const others   = doc.associations.filter(a => a.entity_type !== 'project')
            return (
              <React.Fragment key={doc.id}>
                <Table.Tr>
                  <Table.Td>
                    <button
                      type="button"
                      onClick={() => toggleExpand(doc.id)}
                      aria-label={expanded
                        ? t('documents.page.table.collapse')
                        : t('documents.page.table.expand')}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                  </Table.Td>
                  <Table.Td label={t('documents.page.table.filename')}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Files className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {doc.file_name}
                      </span>
                    </div>
                  </Table.Td>
                  <Table.Td label={t('documents.page.table.category')}>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {breadcrumbFor(cat) || '—'}
                    </span>
                  </Table.Td>
                  <Table.Td label={t('documents.page.table.project')}>
                    {projects.length === 0
                      ? <span className="text-xs text-gray-400">—</span>
                      : (
                        <div className="flex flex-wrap gap-1">
                          {projects.map(renderBadge)}
                        </div>
                      )}
                  </Table.Td>
                  <Table.Td label={t('documents.page.table.uploaded_at')}>
                    <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {format(new Date(doc.uploaded_at), 'dd.MM.yyyy HH:mm')}
                    </span>
                  </Table.Td>
                  <Table.Td sticky>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        icon={openingId === doc.id ? Loader2 : ExternalLink}
                        onClick={() => onOpen(doc)}
                        disabled={openingId === doc.id}
                        title={t('documents.page.actions.open')}
                        className={[
                          'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 bg-transparent',
                          openingId === doc.id ? '[&>svg]:animate-spin' : '',
                        ].join(' ')}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        icon={Trash2}
                        onClick={() => onDelete(doc)}
                        title={t('documents.page.actions.delete')}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 bg-transparent"
                      />
                    </div>
                  </Table.Td>
                </Table.Tr>
                {expanded && (
                  <tr className="bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="space-y-4">
                        <DetailRow label={t('documents.page.table.description')}>
                          {doc.description
                            ? <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{doc.description}</span>
                            : <span className="text-sm italic text-gray-400">{t('documents.page.table.no_description')}</span>}
                        </DetailRow>
                        {others.length > 0 && (
                          <DetailRow label={t('documents.page.table.other_associations')}>
                            <div className="flex flex-wrap gap-1">{others.map(renderBadge)}</div>
                          </DetailRow>
                        )}
                        <DetailRow label={t('documents.page.table.size')}>
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {formatFileSize(doc.file_size)}
                          </span>
                        </DetailRow>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </Table.Body>
      </Table>
    </div>
  )
}

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
      {label}
    </div>
    {children}
  </div>
)

// ===========================================================================
// Helpers
// ===========================================================================

function buildIdMap(tree: DocumentCategoryNode[]): Map<string, DocumentCategory> {
  const m = new Map<string, DocumentCategory>()
  const visit = (n: DocumentCategoryNode) => {
    const { children, ...rest } = n
    m.set(n.id, rest)
    children.forEach(visit)
  }
  tree.forEach(visit)
  return m
}

// For each category node, the list of ids covering that node plus all descendants.
// Used to expand a single-category click into a flat uuid[] for the search RPC.
function buildDescendantsMap(tree: DocumentCategoryNode[]): Map<string, string[]> {
  const m = new Map<string, string[]>()
  const collect = (node: DocumentCategoryNode): string[] => {
    const ids: string[] = [node.id]
    for (const child of node.children) ids.push(...collect(child))
    m.set(node.id, ids)
    return ids
  }
  for (const root of tree) collect(root)
  return m
}

// Roll grouped (own-only) counts up through the tree so each node's number
// reflects its own documents plus those of its descendants.
function rollupCounts(
  tree: DocumentCategoryNode[],
  ownByCategoryId: Map<string, number>,
): Map<string, number> {
  const totals = new Map<string, number>()
  const visit = (node: DocumentCategoryNode): number => {
    let sum = ownByCategoryId.get(node.id) ?? 0
    for (const child of node.children) sum += visit(child)
    totals.set(node.id, sum)
    return sum
  }
  for (const root of tree) visit(root)
  return totals
}

async function fetchProjectOptions(): Promise<SearchableOption[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => ({ value: r.id as string, label: r.name as string }))
}

async function fetchSubcontractorOptions(): Promise<SearchableOption[]> {
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

async function fetchPhaseOptions(): Promise<SearchableOption[]> {
  const { data, error } = await supabase
    .from('project_phases')
    .select('id, phase_name, phase_number, project_id')
    .order('project_id', { ascending: true })
    .order('phase_number', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => ({
    value: r.id as string,
    label: r.phase_name as string,
    sublabel: r.phase_number != null ? `#${r.phase_number}` : undefined,
  }))
}

async function fetchContractOptions(): Promise<SearchableOption[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, contract_number, job_description')
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => {
    const num = r.contract_number as string | null
    const desc = r.job_description as string | null
    const idStr = r.id as string
    return {
      value: idStr,
      label: num || desc?.slice(0, 60) || idStr.slice(0, 8),
    }
  })
}

async function fetchCreditOptions(): Promise<SearchableOption[]> {
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

function badgeVariantForType(type: EntityType): 'blue' | 'purple' | 'teal' | 'orange' | 'gray' {
  switch (type) {
    case 'project':       return 'blue'
    case 'subcontractor': return 'purple'
    case 'contract':      return 'teal'
    case 'unit':          return 'orange'
    case 'customer':      return 'orange'
    default:              return 'gray'
  }
}

interface EntityLookups {
  project: SearchableOption[]
  subcontractor: SearchableOption[]
  phase: SearchableOption[]
  contract: SearchableOption[]
  credit: SearchableOption[]
}

function resolveEntityLabel(a: DocumentAssociation, lookups: EntityLookups): string {
  const fallback = a.entity_id.slice(0, 8)
  switch (a.entity_type) {
    case 'project':       return lookups.project      .find(o => o.value === a.entity_id)?.label ?? fallback
    case 'subcontractor': return lookups.subcontractor.find(o => o.value === a.entity_id)?.label ?? fallback
    case 'phase':         return lookups.phase        .find(o => o.value === a.entity_id)?.label ?? fallback
    case 'contract':      return lookups.contract     .find(o => o.value === a.entity_id)?.label ?? fallback
    case 'credit':        return lookups.credit       .find(o => o.value === a.entity_id)?.label ?? fallback
    default:              return fallback
  }
}
