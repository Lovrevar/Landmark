import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Trash2, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ContractDocument } from './types'
import { fetchSubcontractorDocuments, fetchDocumentsByContract, deleteSubcontractorDocument, getContractDocumentSignedUrl } from './services/siteService'
import { formatFileSize } from '../../../utils/formatters'
import { useToast } from '../../../contexts/ToastContext'
import { ConfirmDialog } from '../../ui'

interface ContractDocumentViewerProps {
  subcontractorId: string
  contractId?: string
  readOnly?: boolean
}

export const ContractDocumentViewer: React.FC<ContractDocumentViewerProps> = ({
  subcontractorId,
  contractId,
  readOnly = false
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [documents, setDocuments] = useState<ContractDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<ContractDocument | null>(null)

  useEffect(() => {
    if (contractId || subcontractorId) {
      loadDocuments()
    }
  }, [subcontractorId, contractId])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const docs = contractId
        ? await fetchDocumentsByContract(contractId)
        : await fetchSubcontractorDocuments(subcontractorId)
      setDocuments(docs)
    } catch {
      setError(t('supervision.site_management.doc_viewer.load_error'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = async (doc: ContractDocument) => {
    try {
      setOpeningId(doc.id)
      const url = await getContractDocumentSignedUrl(doc.file_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error(t('supervision.site_management.doc_viewer.open_error'))
    } finally {
      setOpeningId(null)
    }
  }

  const handleDelete = (doc: ContractDocument) => {
    setPendingDeleteDoc(doc)
  }

  const confirmDeleteDoc = async () => {
    if (!pendingDeleteDoc) return
    try {
      setDeletingId(pendingDeleteDoc.id)
      await deleteSubcontractorDocument(pendingDeleteDoc.id, pendingDeleteDoc.file_path)
      setDocuments((prev) => prev.filter((d) => d.id !== pendingDeleteDoc.id))
    } catch {
      toast.error(t('supervision.site_management.doc_viewer.delete_error'))
    } finally {
      setDeletingId(null)
      setPendingDeleteDoc(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{t('supervision.site_management.doc_viewer.loading')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <AlertCircle className="w-4 h-4 text-red-500" />
        <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('supervision.site_management.doc_viewer.none')}</p>
      </div>
    )
  }

  return (
    <>
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.file_name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(doc.file_size)} &middot; {format(new Date(doc.uploaded_at), 'dd.MM.yyyy HH:mm')}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleOpen(doc)}
              disabled={openingId === doc.id}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50"
              title={t('supervision.site_management.doc_viewer.open')}
            >
              {openingId === doc.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ExternalLink className="w-4 h-4" />
              }
            </button>
            {!readOnly && (
              <button
                onClick={() => handleDelete(doc)}
                disabled={deletingId === doc.id}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                title={t('supervision.site_management.doc_viewer.delete')}
              >
                {deletingId === doc.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />
                }
              </button>
            )}
          </div>
        </div>
      ))}
    </div>

    <ConfirmDialog
      show={!!pendingDeleteDoc}
      title={t('common.confirm_delete')}
      message={pendingDeleteDoc ? t('supervision.site_management.doc_viewer.delete_confirm', { name: pendingDeleteDoc.file_name }) : ''}
      confirmLabel={t('common.yes_delete')}
      cancelLabel={t('common.cancel')}
      variant="danger"
      onConfirm={confirmDeleteDoc}
      onCancel={() => setPendingDeleteDoc(null)}
      loading={!!deletingId}
    />
    </>
  )
}
