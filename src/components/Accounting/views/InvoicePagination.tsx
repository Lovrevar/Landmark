import React from 'react'
import { Pagination } from '../../ui'

interface InvoicePaginationProps {
  currentPage: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
}

export const InvoicePagination: React.FC<InvoicePaginationProps> = ({
  currentPage,
  pageSize,
  totalCount,
  onPageChange
}) => {
  return (
    <Pagination
      currentPage={currentPage}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      itemLabel="računa"
    />
  )
}
