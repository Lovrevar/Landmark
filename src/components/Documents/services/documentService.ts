import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activityLog'
import type {
  AssociationInput,
  Document,
  DocumentAssociation,
  DocumentCategory,
  DocumentCategoryCounts,
  DocumentCategoryNode,
  DocumentFilters,
  DocumentSource,
  DocumentWithRelations,
  EntityType,
  PaginatedDocuments,
  PaginationParams,
  UpdateDocumentInput,
  UploadDocumentInput,
} from '../types'

const BUCKET = 'documents'
const LEGACY_SUBCONTRACTOR_BUCKET = 'contract-documents'
const MAX_FILE_SIZE = 50 * 1024 * 1024
const SIGNED_URL_TTL_SECONDS = 3600

const DOC_WITH_RELATIONS_SELECT =
  '*, category:document_categories(*), associations:document_associations(*)'

// Default unbounded-feeling cap for entity-scoped fetches (fetchDocumentsByEntity).
// A single contract or subcontractor isn't expected to have anywhere near this many.
const ENTITY_FETCH_LIMIT = 5000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFilename(name: string): string {
  // Supabase Storage rejects keys containing ".." (treated as path traversal),
  // which trips on Croatian company suffixes like "d.o.o." + ".pdf" extension.
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+(?=\.[^.]*$|$)/g, '')
}

// Legacy rows migrated from `subcontractor_documents` keep their original
// file paths in the `contract-documents` bucket — new uploads go to `documents`.
function bucketForSource(source: DocumentSource | undefined | null): string {
  return source === 'legacy_subcontractor' ? LEGACY_SUBCONTRACTOR_BUCKET : BUCKET
}

// Escape PostgreSQL LIKE/ILIKE wildcards in user-supplied input. Without this,
// a search like "50_%" would match anything with "50" followed by two chars.
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

function deriveProjectId(associations: AssociationInput[]): string | null {
  return associations.find(a => a.entityType === 'project')?.entityId ?? null
}

function deriveProjectIdFromRows(
  associations: Pick<DocumentAssociation, 'entity_type' | 'entity_id'>[]
): string | null {
  return associations.find(a => a.entity_type === 'project')?.entity_id ?? null
}

function buildCategoryTree(rows: DocumentCategory[]): DocumentCategoryNode[] {
  const byId = new Map<string, DocumentCategoryNode>()
  for (const r of rows) byId.set(r.id, { ...r, children: [] })

  const roots: DocumentCategoryNode[] = []
  for (const r of rows) {
    const node = byId.get(r.id)!
    if (r.parent_id) {
      const parent = byId.get(r.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function fetchCategories(): Promise<DocumentCategoryNode[]> {
  const { data, error } = await supabase
    .from('document_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw error
  return buildCategoryTree((data ?? []) as DocumentCategory[])
}

// ---------------------------------------------------------------------------
// Documents — read
// ---------------------------------------------------------------------------

export async function fetchDocumentById(id: string): Promise<DocumentWithRelations | null> {
  const { data, error } = await supabase
    .from('documents')
    .select(DOC_WITH_RELATIONS_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return (data as DocumentWithRelations | null) ?? null
}

export async function fetchDocumentsByEntity(
  entityType: EntityType,
  entityId: string,
): Promise<DocumentWithRelations[]> {
  const { documents } = await fetchDocuments(
    { entityType, entityId },
    { offset: 0, limit: ENTITY_FETCH_LIMIT },
  )
  return documents
}

export async function fetchDocuments(
  filters: DocumentFilters,
  pagination: PaginationParams = { offset: 0, limit: 100 },
): Promise<PaginatedDocuments> {
  const categoryIds =
    filters.categoryIds && filters.categoryIds.length > 0 ? filters.categoryIds : null

  const fileNameSearch =
    filters.fileNameSearch && filters.fileNameSearch.trim()
      ? `%${escapeLike(filters.fileNameSearch.trim())}%`
      : null

  const { data, error } = await supabase.rpc('search_documents', {
    p_category_ids: categoryIds,
    p_project_id: filters.projectId ?? null,
    p_entity_type: filters.entityType ?? null,
    p_entity_id: filters.entityId ?? null,
    p_file_name_search: fileNameSearch,
    p_uploaded_from: filters.uploadedFrom ?? null,
    p_uploaded_to: filters.uploadedTo ?? null,
    p_offset: pagination.offset,
    p_limit: pagination.limit,
  })

  if (error) throw error

  const rows = (data ?? []) as { document: DocumentWithRelations; total_count: number }[]
  return {
    documents: rows.map(r => r.document),
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
  }
}

// One round-trip grouped count for the sidebar tree. NULL category_id rows
// contribute to `total` and `uncategorizedCount`, but no category node claims them.
//
// Accepts the same filter object as `fetchDocuments` but ignores `categoryIds` —
// the sidebar must keep showing how every category bucket would look under the
// other active filters, otherwise picking a category would zero out the rest.
export async function fetchCategoryCounts(
  filters: DocumentFilters = {},
): Promise<DocumentCategoryCounts> {
  const fileNameSearch =
    filters.fileNameSearch && filters.fileNameSearch.trim()
      ? `%${escapeLike(filters.fileNameSearch.trim())}%`
      : null

  const { data, error } = await supabase.rpc('get_document_category_counts', {
    p_project_id: filters.projectId ?? null,
    p_entity_type: filters.entityType ?? null,
    p_entity_id: filters.entityId ?? null,
    p_file_name_search: fileNameSearch,
    p_uploaded_from: filters.uploadedFrom ?? null,
    p_uploaded_to: filters.uploadedTo ?? null,
  })
  if (error) throw error

  const byCategoryId = new Map<string, number>()
  let uncategorizedCount = 0
  let total = 0

  for (const row of (data ?? []) as { category_id: string | null; doc_count: number }[]) {
    const n = Number(row.doc_count)
    total += n
    if (row.category_id) byCategoryId.set(row.category_id, n)
    else uncategorizedCount += n
  }

  return { byCategoryId, uncategorizedCount, total }
}

// ---------------------------------------------------------------------------
// Documents — write
// ---------------------------------------------------------------------------

export async function uploadDocument(
  file: File,
  input: UploadDocumentInput,
): Promise<DocumentWithRelations> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File "${file.name}" exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`)
  }

  const sanitized = sanitizeFilename(file.name)
  const filePath = `${crypto.randomUUID()}/${sanitized}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: file.type || undefined })
  if (uploadErr) throw uploadErr

  const { data: inserted, error: insertErr } = await supabase
    .from('documents')
    .insert({
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      category_id: input.categoryId ?? null,
      source: 'app_upload',
      description: input.description ?? null,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    await supabase.storage.from(BUCKET).remove([filePath])
    throw insertErr ?? new Error('Document insert returned no row')
  }

  const docId = (inserted as Pick<Document, 'id'>).id

  if (input.associations.length > 0) {
    const rows = input.associations.map(a => ({
      document_id: docId,
      entity_type: a.entityType,
      entity_id: a.entityId,
    }))
    const { error: assocErr } = await supabase
      .from('document_associations')
      .insert(rows)

    if (assocErr) {
      await supabase.from('documents').delete().eq('id', docId)
      await supabase.storage.from(BUCKET).remove([filePath])
      throw assocErr
    }
  }

  logActivity({
    action: 'document.upload',
    entity: 'document',
    entityId: docId,
    projectId: deriveProjectId(input.associations),
    metadata: {
      severity: 'medium',
      file_name: file.name,
      category_id: input.categoryId ?? null,
      association_count: input.associations.length,
    },
  })

  const result = await fetchDocumentById(docId)
  if (!result) throw new Error('Document not found immediately after upload')
  return result
}

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput,
): Promise<DocumentWithRelations> {
  const updateData: Record<string, unknown> = {}
  if ('categoryId'  in input) updateData.category_id = input.categoryId  ?? null
  if ('description' in input) updateData.description = input.description ?? null

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', id)
    if (error) throw error
  }

  if (input.associations !== undefined) {
    const { error } = await supabase.rpc('replace_document_associations', {
      p_document_id: id,
      p_associations: input.associations.map(a => ({
        entityType: a.entityType,
        entityId: a.entityId,
      })),
    })
    if (error) throw error
  }

  const updated = await fetchDocumentById(id)
  if (!updated) throw new Error('Document not found after update')

  logActivity({
    action: 'document.update',
    entity: 'document',
    entityId: id,
    projectId: deriveProjectIdFromRows(updated.associations),
    metadata: {
      severity: 'medium',
      changed_fields: Object.keys(input),
    },
  })

  return updated
}

export async function deleteDocument(id: string): Promise<void> {
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('file_path, source, associations:document_associations(entity_type, entity_id)')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!doc) throw new Error('Document not found')

  // Capture projectId BEFORE any deletion — once the row goes, the
  // associations cascade with it and we lose the chance to attribute the log.
  const associations = ((doc as { associations?: { entity_type: string; entity_id: string }[] })
    .associations ?? []) as Pick<DocumentAssociation, 'entity_type' | 'entity_id'>[]
  const projectId = deriveProjectIdFromRows(associations)
  const filePath = (doc as { file_path: string }).file_path
  const source = (doc as { source: DocumentSource }).source

  const { error: storageErr } = await supabase.storage
    .from(bucketForSource(source))
    .remove([filePath])
  if (storageErr) throw storageErr

  const { error: dbErr } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
  if (dbErr) throw dbErr

  logActivity({
    action: 'document.delete',
    entity: 'document',
    entityId: id,
    projectId,
    metadata: { severity: 'high', file_path: filePath },
  })
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export async function getDocumentSignedUrl(
  filePath: string,
  source?: DocumentSource | null,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucketForSource(source))
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)
  if (error) throw error
  return data.signedUrl
}
