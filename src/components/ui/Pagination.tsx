import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
  itemLabel?: string
  className?: string
}

export default function Pagination({
  currentPage,
  totalCount,
  pageSize,
  onPageChange,
  itemLabel = 'stavki',
  className = '',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = Math.min((currentPage - 1) * pageSize + 1, totalCount)
  const to = Math.min(currentPage * pageSize, totalCount)

  if (totalCount === 0) return null

  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">
          Prikazano: {from}-{to} od {totalCount} {itemLabel}
        </span>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Prethodna
          </button>
          <span className="text-sm text-gray-600">
            Stranica {currentPage} od {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="inline-flex items-center px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Sljedeća
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  )
}
