import React, { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '../../ui'
import { ContractDocumentViewer } from '../../Site/components/ContractDocumentViewer'
import { ContractDocumentUpload } from '../../Site/components/ContractDocumentUpload'
import { uploadSubcontractorDocuments } from '../../Site/services/siteService'

interface Props {
  subcontractorId: string
}

export const SubcontractorDocumentsSection: React.FC<Props> = ({ subcontractorId }) => {
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [viewerKey, setViewerKey] = useState(0)

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return
    try {
      setUploading(true)
      await uploadSubcontractorDocuments(subcontractorId, null, pendingFiles)
      setPendingFiles([])
      setViewerKey(k => k + 1)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Greška pri uploadu dokumenata')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Dokumenti</h3>
      </div>
      <ContractDocumentViewer key={viewerKey} subcontractorId={subcontractorId} />
      <div className="mt-4 border-t border-gray-200 pt-4">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
          Dodaj dokumente
        </p>
        <ContractDocumentUpload files={pendingFiles} onChange={setPendingFiles} />
        {pendingFiles.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            loading={uploading}
            onClick={handleUpload}
          >
            Spremi dokumente
          </Button>
        )}
      </div>
    </div>
  )
}
