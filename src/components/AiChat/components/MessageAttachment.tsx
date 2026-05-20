import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Image as ImageIcon, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { formatFileSize } from '../../../utils/formatters'
import { getAiAttachmentSignedUrl } from '../services/aiAttachmentsService'
import { UI_LABELS_HR } from '../lib/labels'
import type { AiAttachmentRow } from '../../../types/aiChat'

interface Props {
  attachment: AiAttachmentRow
}

// Renders one attachment beneath the user bubble. Images become a 96×96
// thumbnail (signed URL fetched on mount; refetched on <img onError> to
// survive TTL expiry on long-lived sessions). PDFs/text become a download
// chip that fetches its signed URL on click. Click on a thumbnail opens a
// minimal lightbox modal (rendered via a portal so it escapes the chat
// panel's z-index).
export default function MessageAttachment({ attachment }: Props) {
  const { kind, file_name, file_size, storage_path } = attachment
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const refetchThumb = useCallback(async () => {
    if (kind !== 'image') return
    const url = await getAiAttachmentSignedUrl(storage_path)
    setThumbUrl(url)
  }, [kind, storage_path])

  useEffect(() => {
    if (kind !== 'image') return
    let cancelled = false
    void (async () => {
      const url = await getAiAttachmentSignedUrl(storage_path)
      if (!cancelled) setThumbUrl(url)
    })()
    return () => {
      cancelled = true
    }
  }, [kind, storage_path])

  const handleDownloadClick = useCallback(async () => {
    const url = await getAiAttachmentSignedUrl(storage_path)
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [storage_path])

  if (kind === 'image') {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label={UI_LABELS_HR.openImage}
          title={file_name}
          className="block w-24 h-24 rounded-md overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 hover:opacity-90 transition-opacity"
        >
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={file_name}
              className="w-full h-full object-cover"
              onError={() => void refetchThumb()}
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-gray-400">
              <ImageIcon className="w-6 h-6" />
            </span>
          )}
        </button>
        {lightboxOpen && (
          <ImageLightbox
            url={thumbUrl}
            fileName={file_name}
            onClose={() => setLightboxOpen(false)}
            onError={refetchThumb}
          />
        )}
      </>
    )
  }

  // pdf | text: download chip
  return (
    <button
      type="button"
      onClick={() => void handleDownloadClick()}
      title={file_name}
      aria-label={UI_LABELS_HR.downloadAttachment}
      className="inline-flex items-center gap-2 max-w-[260px] rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2.5 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
    >
      <FileText className="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
      <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200">
        {file_name}
      </span>
      <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">
        {formatFileSize(file_size)}
      </span>
      <Download className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
    </button>
  )
}

function ImageLightbox({
  url,
  fileName,
  onClose,
  onError,
}: {
  url: string | null
  fileName: string
  onClose: () => void
  onError: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = 'unset'
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Zatvori"
        className="absolute top-4 right-4 text-white/80 hover:text-white"
      >
        <X className="w-6 h-6" />
      </button>
      {url ? (
        <img
          src={url}
          alt={fileName}
          className="max-w-[92vw] max-h-[92vh] object-contain rounded shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          onError={() => void onError()}
        />
      ) : (
        <span className="text-white/70 text-sm">Učitavanje...</span>
      )}
    </div>,
    document.body,
  )
}
