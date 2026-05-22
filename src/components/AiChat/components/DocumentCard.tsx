import { useCallback, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2, XCircle } from 'lucide-react'
import { generateAndDownloadDocument } from '../lib/documentGenerator'
import { UI_LABELS_HR } from '../lib/labels'
import type { RenderMessage } from '../lib/normalizeMessages'
import type { DocumentFormat } from '../../../types/aiChat'

type DocumentMessage = Extract<RenderMessage, { kind: 'document' }>

const FORMAT_BADGE: Record<DocumentFormat, string> = {
  pdf: 'PDF',
  xlsx: 'XLSX',
  markdown: 'MD',
}

// Renders one `create_document` tool call as a download card. The file is
// generated lazily, client-side, on click (see lib/documentGenerator.ts) —
// the agent-authored spec is carried on the message. While the tool call is
// still in flight (status 'pending') it shows a spinner, matching the plain
// tool-message style.
export default function DocumentCard({ message }: { message: DocumentMessage }) {
  const { spec, status } = message
  const [generating, setGenerating] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleDownload = useCallback(async () => {
    setGenerating(true)
    setFailed(false)
    try {
      await generateAndDownloadDocument(spec)
    } catch (err) {
      console.error('[DocumentCard] document generation failed:', err)
      setFailed(true)
    } finally {
      setGenerating(false)
    }
  }, [spec])

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 px-1 py-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
        <span>{UI_LABELS_HR.preparingDocument}</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 px-1 py-1.5">
        <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{UI_LABELS_HR.documentGenerationFailed}</span>
      </div>
    )
  }

  const Icon = spec.format === 'xlsx' ? FileSpreadsheet : FileText
  return (
    <div className="flex flex-col items-start gap-1 py-1">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={generating}
        title={spec.title}
        aria-label={UI_LABELS_HR.downloadDocument}
        className="inline-flex items-center gap-2 max-w-[280px] rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2.5 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <Icon className="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
        <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200">
          {spec.title}
        </span>
        <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {FORMAT_BADGE[spec.format]}
        </span>
        {generating ? (
          <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-gray-400 dark:text-gray-500" />
        ) : (
          <Download className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
        )}
      </button>
      {failed && (
        <span className="text-[11px] text-red-600 dark:text-red-400 px-1">
          {UI_LABELS_HR.documentGenerationFailed}
        </span>
      )}
    </div>
  )
}
