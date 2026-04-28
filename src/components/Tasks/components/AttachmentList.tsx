import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, Trash2, Upload, FileText, Image as ImageIcon, AlertCircle, Loader2 } from 'lucide-react'
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TASK,
  deleteTaskAttachment,
  getAttachmentSignedUrl,
  uploadTaskAttachment,
} from '../services/tasksService'
import type { TaskAttachment } from '../../../types/tasks'

interface Props {
  taskId: string | null
  attachments: TaskAttachment[]
  userId: string
  userRole: string
  canDelete: (attachment: TaskAttachment) => boolean
  onChange: () => void
  disabled?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

const AttachmentList: React.FC<Props> = ({
  taskId,
  attachments,
  userId,
  userRole,
  canDelete,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const next: Record<string, string> = {}
      await Promise.all(
        attachments
          .filter(a => isImage(a.mime_type))
          .map(async a => {
            const { data } = await getAttachmentSignedUrl(a.storage_path, 3600)
            if (data?.signedUrl) next[a.id] = data.signedUrl
          }),
      )
      if (!cancelled) setThumbs(next)
    }
    load()
    return () => { cancelled = true }
  }, [attachments])

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!taskId || disabled) return
      setError(null)
      const list = Array.from(files)
      const room = MAX_ATTACHMENTS_PER_TASK - attachments.length
      if (room <= 0) {
        setError(t('tasks.attachments.count_limit', { max: MAX_ATTACHMENTS_PER_TASK }))
        return
      }
      const toUpload = list.slice(0, room)
      const rejected = list.filter(f => f.size > MAX_ATTACHMENT_BYTES)
      if (rejected.length > 0) {
        setError(t('tasks.attachments.size_limit', { max: MAX_ATTACHMENT_BYTES / 1024 / 1024 }))
      }
      for (const f of toUpload) {
        if (f.size > MAX_ATTACHMENT_BYTES) continue
        const key = `${f.name}-${f.size}-${Date.now()}`
        setUploading(u => [...u, key])
        try {
          await uploadTaskAttachment(taskId, f, userId, userRole)
          onChange()
        } catch (e) {
          setError(e instanceof Error ? e.message : t('tasks.attachments.failed'))
        } finally {
          setUploading(u => u.filter(k => k !== key))
        }
      }
    },
    [taskId, disabled, attachments.length, userId, userRole, onChange, t],
  )

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  const handleDelete = async (a: TaskAttachment) => {
    if (disabled) return
    await deleteTaskAttachment(a.id, userId, userRole)
    onChange()
  }

  const handleOpen = async (a: TaskAttachment) => {
    const { data } = await getAttachmentSignedUrl(a.storage_path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const atLimit = attachments.length >= MAX_ATTACHMENTS_PER_TASK

  return (
    <div className="space-y-2">
      <div
        onDragEnter={e => { e.preventDefault(); setIsDragging(true) }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !atLimit && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          disabled || atLimit ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'
        } ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
          disabled={disabled || atLimit}
        />
        <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {t('tasks.attachments.drop_hint')}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {t('tasks.attachments.limits', {
            size: MAX_ATTACHMENT_BYTES / 1024 / 1024,
            count: MAX_ATTACHMENTS_PER_TASK,
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {(attachments.length > 0 || uploading.length > 0) && (
        <div className="space-y-1.5">
          {attachments.map(a => {
            const thumb = thumbs[a.id]
            return (
              <div
                key={a.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={a.file_name}
                    className="w-9 h-9 rounded object-cover flex-shrink-0"
                  />
                ) : isImage(a.mime_type) ? (
                  <ImageIcon className="w-9 h-9 p-2 text-gray-400 flex-shrink-0" />
                ) : (
                  <FileText className="w-9 h-9 p-2 text-gray-400 flex-shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => handleOpen(a)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {a.file_name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatSize(a.size_bytes)}
                  </div>
                </button>
                {canDelete(a) && !disabled && (
                  <button
                    type="button"
                    onClick={() => handleDelete(a)}
                    className="text-gray-400 hover:text-red-500"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
          {uploading.map(k => (
            <div
              key={k}
              className="flex items-center gap-2 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
            >
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <div className="text-sm text-gray-700 dark:text-gray-200">
                {t('tasks.attachments.uploading')}
              </div>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && uploading.length === 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Paperclip className="w-3 h-3" />
          {t('tasks.attachments.none')}
        </div>
      )}
    </div>
  )
}

export default AttachmentList
