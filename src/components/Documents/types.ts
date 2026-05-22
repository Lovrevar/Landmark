export type EntityType =
  | 'project'
  | 'phase'
  | 'subcontractor'
  | 'contract'
  | 'unit'
  | 'customer'
  | 'credit'
  | 'company'

export type DocumentSource =
  | 'app_upload'
  | 'legacy_subcontractor'
  | 'accounting_sync'
  | 'filesystem_scan'
  | 'email_import'

export interface DocumentCategory {
  id: string
  code: string
  name_hr: string
  parent_id: string | null
  path: string
  display_order: number
  required_associations: EntityType[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DocumentCategoryNode extends DocumentCategory {
  children: DocumentCategoryNode[]
}

export interface DocumentAssociation {
  id: string
  document_id: string
  entity_type: EntityType
  entity_id: string
}

export interface Document {
  id: string
  file_path: string
  file_name: string
  file_size: number
  mime_type: string | null
  category_id: string | null
  source: DocumentSource
  description: string | null
  uploaded_by: string | null
  uploaded_at: string
  // SHA-256 of the file bytes. Populated only for email-imported documents
  // (source = 'email_import'), where it powers retry deduplication.
  content_hash: string | null
}

export interface DocumentWithRelations extends Document {
  category: DocumentCategory | null
  associations: DocumentAssociation[]
}

export interface DocumentFilters {
  // Pre-resolved category set (selected category + descendants if applicable).
  // Empty / undefined means "any category".
  categoryIds?: string[]
  entityType?: EntityType
  entityId?: string
  fileNameSearch?: string
  uploadedFrom?: string
  uploadedTo?: string
  projectId?: string
}

export interface PaginationParams {
  offset: number
  limit: number
}

export interface PaginatedDocuments {
  documents: DocumentWithRelations[]
  totalCount: number
}

export interface DocumentCategoryCounts {
  byCategoryId: Map<string, number>
  uncategorizedCount: number
  total: number
}

export interface AssociationInput {
  entityType: EntityType
  entityId: string
}

export interface UploadDocumentInput {
  categoryId?: string | null
  associations: AssociationInput[]
  description?: string | null
}

export interface UpdateDocumentInput {
  categoryId?: string | null
  description?: string | null
  associations?: AssociationInput[]
}
