import { useState, useEffect } from 'react'

export interface ColumnVisibility {
  approved: boolean
  type: boolean
  invoice_number: boolean
  company: boolean
  supplier_customer: boolean
  category: boolean
  issue_date: boolean
  due_date: boolean
  base_amount: boolean
  vat: boolean
  total_amount: boolean
  paid_amount: boolean
  remaining_amount: boolean
  status: boolean
}

const defaultColumns: ColumnVisibility = {
  approved: true,
  type: true,
  invoice_number: true,
  company: true,
  supplier_customer: true,
  category: true,
  issue_date: true,
  due_date: true,
  base_amount: true,
  vat: true,
  total_amount: true,
  paid_amount: true,
  remaining_amount: true,
  status: true
}

export const useInvoiceColumns = () => {
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    const saved = localStorage.getItem('accountingInvoicesColumns')
    return saved ? JSON.parse(saved) : defaultColumns
  })

  const [showColumnMenu, setShowColumnMenu] = useState(false)

  useEffect(() => {
    localStorage.setItem('accountingInvoicesColumns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.column-menu-container')) {
        setShowColumnMenu(false)
      }
    }

    if (showColumnMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColumnMenu])

  return {
    visibleColumns,
    setVisibleColumns,
    showColumnMenu,
    setShowColumnMenu
  }
}
