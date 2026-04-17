import { useState, useEffect } from 'react'
import type { ActivityLogEntry, ActionCategory, SeverityFilter } from '../types'
import * as queryService from '../services/activityLogQueryService'

export function useActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [filterUserId, setFilterUserId] = useState('ALL')
  const [filterCategory, setFilterCategory] = useState<ActionCategory>('ALL')
  const [filterSeverity, setFilterSeverity] = useState<SeverityFilter>('ALL')
  const [filterProjectId, setFilterProjectId] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Reference data for filter dropdowns
  const [users, setUsers] = useState<{ id: string; username: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])

  // Detail modal state
  const [selectedLog, setSelectedLog] = useState<ActivityLogEntry | null>(null)

  // Debounced search (500ms, same as useInvoices)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterUserId, filterCategory, filterSeverity, filterProjectId, dateFrom, dateTo, debouncedSearchTerm])

  // Fetch logs when filters or page change
  useEffect(() => {
    fetchLogs()
  }, [currentPage, filterUserId, filterCategory, filterSeverity, filterProjectId, dateFrom, dateTo, debouncedSearchTerm])

  // Fetch reference data once on mount
  useEffect(() => {
    Promise.all([
      queryService.fetchLogUsers(),
      queryService.fetchProjects(),
    ]).then(([usersData, projectsData]) => {
      setUsers(usersData)
      setProjects(projectsData)
    }).catch((err) => {
      console.error('Error fetching reference data:', err)
    })
  }, [])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const data = await queryService.fetchActivityLogs(
        {
          userId: filterUserId !== 'ALL' ? filterUserId : null,
          actionPrefix: filterCategory !== 'ALL' ? filterCategory : null,
          severity: filterSeverity !== 'ALL' ? filterSeverity : null,
          searchTerm: debouncedSearchTerm || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          projectId: filterProjectId !== 'ALL' ? filterProjectId : null,
        },
        (currentPage - 1) * pageSize,
        pageSize
      )

      setLogs(data)
      setTotalCount(data.length > 0 ? data[0].total_count : 0)
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      setLogs([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setSearchTerm('')
    setFilterUserId('ALL')
    setFilterCategory('ALL')
    setFilterSeverity('ALL')
    setFilterProjectId('ALL')
    setDateFrom('')
    setDateTo('')
  }

  return {
    logs,
    loading,
    totalCount,
    currentPage,
    pageSize,
    searchTerm,
    filterUserId,
    filterCategory,
    filterSeverity,
    filterProjectId,
    dateFrom,
    dateTo,
    users,
    projects,
    selectedLog,
    setSearchTerm,
    setFilterUserId,
    setFilterCategory,
    setFilterSeverity,
    setFilterProjectId,
    setDateFrom,
    setDateTo,
    setCurrentPage,
    setSelectedLog,
    resetFilters,
    refetch: fetchLogs,
  }
}
