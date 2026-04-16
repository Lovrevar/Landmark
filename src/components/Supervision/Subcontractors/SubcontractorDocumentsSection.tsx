import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import { Button } from '../../ui'
import { ContractDocumentViewer } from '../SiteManagement/ContractDocumentViewer'
import { ContractDocumentUpload } from '../SiteManagement/ContractDocumentUpload'
import { uploadSubcontractorDocuments } from '../SiteManagement/services/siteService'
import { useToast } from '../../../contexts/ToastContext'

interface Props {
  subcontractorId: string
}

export const SubcontractorDocumentsSection: React.FC<Props> = ({ subcontractorId }) => {
  const { t } = useTranslation()
  const toast = useToast()
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
      toast.error(err instanceof Error ? err.message : t('supervision.subcontractors.upload_error'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('common.documents')}</h3>
      </div>
      <ContractDocumentViewer key={viewerKey} subcontractorId={subcontractorId} />
      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
          {t('supervision.subcontractors.add_documents')}
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
            {t('supervision.subcontractors.save_documents')}
          </Button>
        )}
      </div>
    </div>
  )
}
