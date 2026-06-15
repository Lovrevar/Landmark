import { useState, useEffect, useRef, useCallback } from 'react'
import { ApartmentWithDetails } from '../types'
import {
  fetchApartmentListPage,
  fetchApartmentFilterOptions,
  type LinkedUnit,
} from '../services/apartmentListService'

export const APARTMENTS_PAGE_SIZE = 24

interface UseApartmentDataResult {
  apartments: ApartmentWithDetails[]
  totalCount: number
  projects: Array<{ id: string; name: string }>
  buildings: Array<{ id: string; name: string; project_id: string }>
  apartmentPaymentTotals: Record<string, number>
  linkedGarages: Record<string, LinkedUnit[]>
  linkedStorages: Record<string, LinkedUnit[]>
  loading: boolean
  refreshing: boolean
  refetch: () => void
  pageSize: number
  currentPage: number
  setCurrentPage: (page: number) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  filterProject: string
  setFilterProject: (id: string) => void
  filterBuilding: string
  setFilterBuilding: (id: string) => void
  filterStatus: string
  setFilterStatus: (status: string) => void
}

export function useApartmentData(): UseApartmentDataResult {
  const [apartments, setApartments] = useState<ApartmentWithDetails[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string; project_id: string }>>([])
  const [apartmentPaymentTotals, setApartmentPaymentTotals] = useState<Record<string, number>>({})
  const [linkedGarages, setLinkedGarages] = useState<Record<string, LinkedUnit[]>>({})
  const [linkedStorages, setLinkedStorages] = useState<Record<string, LinkedUnit[]>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const hasLoadedRef = useRef(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [filterProject, setFilterProject] = useState('all')
  const [filterBuilding, setFilterBuilding] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterProject, filterBuilding, filterStatus])

  useEffect(() => {
    fetchApartmentFilterOptions()
      .then(opts => {
        setProjects(opts.projects)
        setBuildings(opts.buildings)
      })
      .catch(err => console.error('Error fetching apartment filter options:', err))
  }, [])

  const fetchData = useCallback(async () => {
    if (hasLoadedRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await fetchApartmentListPage({
        page: currentPage,
        pageSize: APARTMENTS_PAGE_SIZE,
        searchTerm: debouncedSearchTerm,
        projectId: filterProject,
        buildingId: filterBuilding,
        status: filterStatus,
      })
      setApartments(data.apartments)
      setTotalCount(data.totalCount)
      setApartmentPaymentTotals(data.apartmentPaymentTotals)
      setLinkedGarages(data.linkedGarages)
      setLinkedStorages(data.linkedStorages)
      hasLoadedRef.current = true
    } catch (error) {
      console.error('Error fetching apartments:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentPage, debouncedSearchTerm, filterProject, filterBuilding, filterStatus])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    apartments,
    totalCount,
    projects,
    buildings,
    apartmentPaymentTotals,
    linkedGarages,
    linkedStorages,
    loading,
    refreshing,
    refetch: fetchData,
    pageSize: APARTMENTS_PAGE_SIZE,
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm,
    filterProject,
    setFilterProject,
    filterBuilding,
    setFilterBuilding,
    filterStatus,
    setFilterStatus,
  }
}
