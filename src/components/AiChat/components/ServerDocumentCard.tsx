import { useCallback, useState } from 'react'
import { Download, FileText, Loader2, XCircle } from 'lucide-react'
import { getServerDocumentSignedUrl } from '../services/aiAttachmentsService'
import { UI_LABELS_HR } from '../lib/labels'
import type { RenderMessage } from '../lib/normalizeMessages'

type ServerDocumentMessage = Extract<RenderMessage, { kind: 'server_document' }>

// Renders one `get_document_download_link` tool call as a download chip for
// a system-stored document (i.e. an entry in the `documents` table — distinct
// from `create_document`, which generates a file client-side from an
// agent-authored spec). The signed URL is minted on click rather than baked
// into the message so a history reload past the URL's TTL still works.
export default function ServerDocumentCard({ message }: { message: ServerDocumentMessage }) {
  const { status, fileName, filePath, source } = message
  const [resolving, setResolving] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleDownload = useCallback(async () => {
    if (!filePath || !source) return
    setResolving(true)
    setFailed(false)
    try {
      const url = await getServerDocumentSignedUrl(filePath, source)
      if (!url) {
        setFailed(true)
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('[ServerDocumentCard] signed URL fetch failed:', err)
      setFailed(true)
    } finally {
      setResolving(false)
    }
  }, [filePath, source])

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 px-1 py-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
        <span>{UI_LABELS_HR.fetchingServerDocument}</span>
      </div>
    )
  }

  if (status === 'error' || !filePath || !source || !fileName) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 px-1 py-1.5">
        <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{UI_LABELS_HR.serverDocumentFetchFailed}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1 py-1">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={resolving}
        title={fileName}
        aria-label={UI_LABELS_HR.downloadDocument}
        className="inline-flex items-center gap-2 max-w-[280px] rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2.5 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <FileText className="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
        <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200">
          {fileName}
        </span>
        {resolving ? (
          <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-gray-400 dark:text-gray-500" />
        ) : (
          <Download className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
        )}
      </button>
      {failed && (
        <span className="text-[11px] text-red-600 dark:text-red-400 px-1">
          {UI_LABELS_HR.serverDocumentFetchFailed}
        </span>
      )}
    </div>
  )
}
