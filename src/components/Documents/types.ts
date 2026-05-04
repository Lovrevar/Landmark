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
}

export interface DocumentWithRelations extends Document {
  category: DocumentCategory | null
  associations: DocumentAssociation[]
}

export interface DocumentFilters {
  categoryId?: string
  includeChildren?: boolean
  entityType?: EntityType
  entityId?: string
  fileNameSearch?: string
  uploadedFrom?: string
  uploadedTo?: string
  projectId?: string
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
