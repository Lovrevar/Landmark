import { useState, useEffect, useCallback } from 'react'
import { DebtSummary } from '../types'
import { toLoadError } from '../../services/loadError'
import { fetchDebtData, fetchProjects } from '../services/debtService'

interface Project {
  id: string
  name: string
  type: 'site' | 'retail'
}

export const useDebtStatus = () => {
  const [debtData, setDebtData] = useState<DebtSummary[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  // Kept apart so a debt reload cannot silently clear a failed project list, or vice versa.
  const [debtError, setDebtError] = useState<Error | null>(null)
  const [projectsError, setProjectsError] = useState<Error | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'unpaid' | 'paid'>('unpaid')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadProjects = useCallback(async () => {
    setProjectsError(null)
    try {
      const data = await fetchProjects()
      setProjects(data)
    } catch (error) {
      console.error('Error fetching projects:', error)
      setProjectsError(toLoadError(error))
    }
  }, [])

  const loadDebtData = useCallback(async () => {
    setDebtError(null)
    try {
      setLoading(true)
      const data = await fetchDebtData(selectedProjectId || undefined)
      setDebtData(data)
    } catch (error) {
      console.error('Error fetching debt data:', error)
      setDebtError(toLoadError(error))
      // The previous project's figures must not stand in for the one that just failed.
      setDebtData([])
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  const error = debtError ?? projectsError

  const refetch = useCallback(async () => {
    await Promise.all([loadProjects(), loadDebtData()])
  }, [loadProjects, loadDebtData])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    loadDebtData()
  }, [loadDebtData])

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
    error,
    refetch,
    dismissError: () => { setDebtError(null); setProjectsError(null) },
    /** No export may be produced from a failed load — an empty Excel/PDF reads as "no debt". */
    canExport: !debtError && debtData.length > 0,
    sortBy,
    sortOrder,
    sortedData,
    totalUnpaid,
    totalPaid,
    totalSuppliers,
    suppliersWithDebt,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    handleSort
  }
}
