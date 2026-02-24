import React, { useRef } from 'react'
import { Upload, X, FileText, AlertCircle } from 'lucide-react'

interface ContractDocumentUploadProps {
  files: File[]
  onChange: (files: File[]) => void
  error?: string | null
}

const MAX_FILE_SIZE = 25 * 1024 * 1024
const ACCEPTED_TYPE = 'application/pdf'

export const ContractDocumentUpload: React.FC<ContractDocumentUploadProps> = ({
  files,
  onChange,
  error
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleFileSelect = (selected: FileList | null) => {
    if (!selected) return

    const newFiles: File[] = []
    const errors: string[] = []

    Array.from(selected).forEach((file) => {
      if (file.type !== ACCEPTED_TYPE) {
        errors.push(`"${file.name}" nije PDF dokument`)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" premašuje 25MB ograničenje`)
        return
      }
      const isDuplicate = files.some((f) => f.name === file.name && f.size === file.size)
      if (!isDuplicate) {
        newFiles.push(file)
      }
    })

    if (errors.length > 0) {
      alert(errors.join('\n'))
    }

    if (newFiles.length > 0) {
      onChange([...files, ...newFiles])
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index)
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">
          Povucite PDF dokumente ovdje ili kliknite za odabir
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Samo PDF datoteke, max 25MB po dokumentu
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            Odabrani dokumenti ({files.length})
          </p>
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
            >
              <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                title="Ukloni"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
