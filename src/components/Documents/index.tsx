import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Folder } from 'lucide-react'

import {
  PageHeader, Button, LoadingSpinner, ConfirmDialog, Pagination,
} from '../ui'
import SearchableSelect, { type SearchableOption } from '../ui/SearchableSelect'
import { useToast } from '../../contexts/ToastContext'

import {
  fetchCategories, fetchCategoryCounts, fetchDocuments, getDocumentSignedUrl, deleteDocument,
} from './services/documentService'
import {
  fetchProjectOptions,
  fetchSubcontractorOptions,
  fetchPhaseOptions,
  fetchContractOptions,
  fetchCreditOptions,
} from './services/documentOptionsService'
import type {
  DocumentCategory,
  DocumentCategoryNode,
  DocumentFilters,
  DocumentWithRelations,
  EntityType,
} from './types'
import { DocumentUploadModal } from './DocumentUploadModal'
import { buildIdMap, buildDescendantsMap, rollupCounts } from './utils/treeHelpers'
import { CategoryRow } from './components/CategoryRow'
import { DocumentListTable } from './components/DocumentListTable'

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
    // Counts are fetched by a separate filter-aware effect below; we only need
    // the category tree + option lists here to drive the first render.
    Promise.all([
      fetchCategories(),
      fetchProjectOptions(),
      fetchSubcontractorOptions(),
      fetchPhaseOptions(),
      fetchContractOptions(),
      fetchCreditOptions(),
    ])
      .then(([tree, projects, subs, phases, contracts, credits]) => {
        if (cancelled) return
        setCategoryTree(tree)
        setCategoryById(buildIdMap(tree))
        setDescendantsById(buildDescendantsMap(tree))
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

  // Filters shared by the list and the sidebar counts. The sidebar deliberately
  // does NOT apply the category selection (see countFilters below) — otherwise
  // picking a category would zero out every other bucket in the tree.
  const countFilters: DocumentFilters = useMemo(() => ({
    ...(projectId && { projectId }),
    ...(subcontractorId && { entityType: 'subcontractor' as EntityType, entityId: subcontractorId }),
    ...(debouncedSearch.trim() && { fileNameSearch: debouncedSearch.trim() }),
    ...(uploadedFrom && { uploadedFrom: `${uploadedFrom}T00:00:00.000Z` }),
    ...(uploadedTo   && { uploadedTo:   `${uploadedTo}T23:59:59.999Z` }),
  }), [projectId, subcontractorId, debouncedSearch, uploadedFrom, uploadedTo])

  const filterParams: DocumentFilters = useMemo(() => {
    const categoryIds = selectedCategoryId
      ? descendantsById.get(selectedCategoryId) ?? [selectedCategoryId]
      : undefined
    return {
      ...countFilters,
      ...(categoryIds && { categoryIds }),
    }
  }, [selectedCategoryId, descendantsById, countFilters])

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

  // Sidebar counts must track filter changes — without this, the per-category
  // numbers stay frozen at their global load-time values while the right-hand
  // list narrows.
  useEffect(() => {
    if (loading) return
    let cancelled = false
    fetchCategoryCounts(countFilters)
      .then(counts => {
        if (cancelled) return
        setCategoryCounts(rollupCounts(categoryTree, counts.byCategoryId))
        setSidebarTotalCount(counts.total)
      })
      .catch(() => {
        // best-effort; the list fetch above will still surface any auth/RPC errors
      })
    return () => { cancelled = true }
  }, [countFilters, categoryTree, loading])

  // ---- Mutation refresh --------------------------------------------------

  const refreshCounts = async () => {
    try {
      const counts = await fetchCategoryCounts(countFilters)
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
