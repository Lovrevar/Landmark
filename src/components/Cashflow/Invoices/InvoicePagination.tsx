import React from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  return (
    <Pagination
      currentPage={currentPage}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      itemLabel={t('invoices.pagination.item_label')}
    />
  )
}
