import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, X, FileText } from 'lucide-react'

import { FormField } from '../../ui'
import { useToast } from '../../../contexts/ToastContext'
import { formatFileSize } from '../../../utils/formatters'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_FILE_SIZE_MB = 50

interface FilePickerFieldProps {
  files: File[]
  onChange: (files: File[]) => void
  error?: string
  disabled?: boolean
}

export const FilePickerField: React.FC<FilePickerFieldProps> = ({ files, onChange, error, disabled }) => {
  const { t } = useTranslation()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draggingOver, setDraggingOver] = useState(false)

  const handleSelect = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return

    const accepted: File[] = []
    const rejected: string[] = []
    Array.from(selected).forEach(f => {
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(f.name)
        return
      }
      // Skip duplicates by (name, size) — covers re-picking the same file and
      // re-dropping a batch the user already added.
      const dupe =
        files.some(x => x.name === f.name && x.size === f.size) ||
        accepted.some(x => x.name === f.name && x.size === f.size)
      if (!dupe) accepted.push(f)
    })

    if (rejected.length > 0) {
      // One toast per rejected name keeps the message readable when the user
      // drops a mixed batch of small + huge files.
      rejected.forEach(name => {
        toast.error(t('documents.upload_modal.errors.file_too_large_named', {
          name, limit: MAX_FILE_SIZE_MB,
        }))
      })
    }
    if (accepted.length > 0) {
      onChange([...files, ...accepted])
    }
    // Reset the native input so re-picking the exact same file still triggers onChange.
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeAt = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <FormField
      label={t('documents.upload_modal.file_label')}
      required
      error={error}
    >
      <div
        onDrop={(e) => {
          e.preventDefault()
          setDraggingOver(false)
          if (!disabled) handleSelect(e.dataTransfer.files)
        }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDraggingOver(true) }}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDraggingOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDraggingOver(false) }}
        onClick={() => { if (!disabled) inputRef.current?.click() }}
        className={[
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          disabled
            ? 'opacity-60 cursor-not-allowed border-gray-300 dark:border-gray-600'
            : draggingOver
              ? 'cursor-pointer border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
              : 'cursor-pointer border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleSelect(e.target.files)}
        />
        <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('documents.upload_modal.drag_or_click')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t('documents.upload_modal.any_type_hint')}
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {t('documents.upload_modal.selected_count', { count: files.length })}
          </p>
          {files.map((f, i) => (
            <div
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{f.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(f.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeAt(i) }}
                disabled={disabled}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0 disabled:opacity-50"
                title={t('documents.upload_modal.remove_file')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </FormField>
  )
}
