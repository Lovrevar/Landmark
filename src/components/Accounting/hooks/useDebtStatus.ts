import { useState, useEffect } from 'react'
import { DebtSummary } from '../types/debtTypes'
import { fetchDebtData } from '../services/debtService'

export const useDebtStatus = () => {
  const [debtData, setDebtData] = useState<DebtSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'name' | 'unpaid' | 'paid'>('unpaid')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadDebtData()
  }, [])

  const loadDebtData = async () => {
    try {
      setLoading(true)
      const data = await fetchDebtData()
      setDebtData(data)
    } catch (error) {
      console.error('Error fetching debt data:', error)
    } finally {
      setLoading(false)
    }
  }

  const sortedData = [...debtData].sort((a, b) => {
    let compareValue = 0

    switch (sortBy) {
      case 'name':
        compareValue = a.supplier_name.localeCompare(b.supplier_name)
        break
      case 'unpaid':
        compareValue = a.total_unpaid - b.total_unpaid
        break
      case 'paid':
        compareValue = a.total_paid - b.total_paid
        break
    }

    return sortOrder === 'asc' ? compareValue : -compareValue
  })

  const totalUnpaid = debtData.reduce((sum, d) => sum + d.total_unpaid, 0)
  const totalPaid = debtData.reduce((sum, d) => sum + d.total_paid, 0)
  const totalSuppliers = debtData.length
  const suppliersWithDebt = debtData.filter(d => d.total_unpaid > 0).length

  const handleSort = (field: 'name' | 'unpaid' | 'paid') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'name' ? 'asc' : 'desc')
    }
  }

  return {
    debtData,
    loading,
    sortBy,
    sortOrder,
    sortedData,
    totalUnpaid,
    totalPaid,
    totalSuppliers,
    suppliersWithDebt,
    handleSort
  }
}
