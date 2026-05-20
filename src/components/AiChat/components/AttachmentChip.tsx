import { AlertCircle, FileText, Image as ImageIcon, Loader2, Paperclip, X } from 'lucide-react'
import { formatFileSize } from '../../../utils/formatters'
import { ERROR_LABELS_HR, UI_LABELS_HR } from '../lib/labels'
import type { PendingAttachment } from '../hooks/useAiChatStore'

interface Props {
  attachment: PendingAttachment
  disabled?: boolean
  onRemove: () => void
}

// Pill shown in the input tray above the textarea for a pending attachment.
// Three visual states: uploading (spinner overlay), error (red border + alert
// icon), and ready (kind icon + filename + size). The remove X is always
// rendered so users can cancel mid-upload or retry by re-selecting.
export default function AttachmentChip({ attachment, disabled, onRemove }: Props) {
  const isError = attachment.status === 'error'
  const isUploading = attachment.status === 'uploading'

  const file = attachment.file
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext)
  const isPdf = ext === 'pdf'

  const Icon = isError
    ? AlertCircle
    : isImage
      ? ImageIcon
      : isPdf || ['txt', 'csv', 'xls', 'xlsx'].includes(ext)
        ? FileText
        : Paperclip

  const borderClass = isError
    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
    : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'

  return (
    <div
      className={`inline-flex items-center gap-2 max-w-[220px] rounded-md border px-2 py-1 text-xs ${borderClass}`}
      title={isError ? ERROR_LABELS_HR[attachment.errorCode ?? ''] ?? UI_LABELS_HR.uploadFailed : file.name}
    >
      <span className="flex-shrink-0">
        {isUploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500 dark:text-gray-400" />
        ) : (
          <Icon
            className={`w-3.5 h-3.5 ${isError ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}
          />
        )}
      </span>
      <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200">
        {file.name}
      </span>
      <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">
        {formatFileSize(file.size)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={UI_LABELS_HR.removeAttachment}
        className="flex-shrink-0 -mr-1 p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
