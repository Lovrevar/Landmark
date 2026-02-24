import React, { useState, useEffect } from 'react'
import { FileText, Trash2, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ContractDocument } from '../types/siteTypes'
import { fetchContractDocuments, deleteContractDocument, getContractDocumentSignedUrl } from '../services/siteService'

interface ContractDocumentViewerProps {
  contractId: string
  readOnly?: boolean
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const ContractDocumentViewer: React.FC<ContractDocumentViewerProps> = ({
  contractId,
  readOnly = false
}) => {
  const [documents, setDocuments] = useState<ContractDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (contractId) {
      loadDocuments()
    }
  }, [contractId])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const docs = await fetchContractDocuments(contractId)
      setDocuments(docs)
    } catch {
      setError('Greška pri učitavanju dokumenata')
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
      alert('Greška pri otvaranju dokumenta')
    } finally {
      setOpeningId(null)
    }
  }

  const handleDelete = async (doc: ContractDocument) => {
    if (!confirm(`Jeste li sigurni da želite obrisati "${doc.file_name}"?`)) return

    try {
      setDeletingId(doc.id)
      await deleteContractDocument(doc.id, doc.file_path)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch {
      alert('Greška pri brisanju dokumenta')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Učitavanje dokumenata...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-4 h-4 text-red-500" />
        <span className="text-sm text-red-700">{error}</span>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-1" />
        <p className="text-sm text-gray-500">Nema priloženih dokumenata</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
            <p className="text-xs text-gray-500">
              {formatSize(doc.file_size)} &middot; {format(new Date(doc.uploaded_at), 'dd.MM.yyyy HH:mm')}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleOpen(doc)}
              disabled={openingId === doc.id}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
              title="Otvori dokument"
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
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Obriši dokument"
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
  )
}
