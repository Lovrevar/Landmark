import { useState, useEffect, useCallback } from 'react'
import { ApartmentWithDetails } from '../types'
import {
  fetchApartmentListData,
  type LinkedUnit,
} from '../services/apartmentListService'

interface UseApartmentDataResult {
  apartments: ApartmentWithDetails[]
  projects: Array<{ id: string; name: string }>
  buildings: Array<{ id: string; name: string; project_id: string }>
  apartmentPaymentTotals: Record<string, number>
  garagePaymentTotals: Record<string, number>
  storagePaymentTotals: Record<string, number>
  linkedGarages: Record<string, LinkedUnit[]>
  linkedStorages: Record<string, LinkedUnit[]>
  loading: boolean
  refetch: () => void
}

export function useApartmentData(): UseApartmentDataResult {
  const [apartments, setApartments] = useState<ApartmentWithDetails[]>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string; project_id: string }>>([])
  const [apartmentPaymentTotals, setApartmentPaymentTotals] = useState<Record<string, number>>({})
  const [garagePaymentTotals] = useState<Record<string, number>>({})
  const [storagePaymentTotals] = useState<Record<string, number>>({})
  const [linkedGarages, setLinkedGarages] = useState<Record<string, LinkedUnit[]>>({})
  const [linkedStorages, setLinkedStorages] = useState<Record<string, LinkedUnit[]>>({})
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchApartmentListData()
      setApartments(data.apartments)
      setProjects(data.projects)
      setBuildings(data.buildings)
      setApartmentPaymentTotals(data.apartmentPaymentTotals)
      setLinkedGarages(data.linkedGarages)
      setLinkedStorages(data.linkedStorages)
    } catch (error) {
      console.error('Error fetching apartments:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    apartments,
    projects,
    buildings,
    apartmentPaymentTotals,
    garagePaymentTotals,
    storagePaymentTotals,
    linkedGarages,
    linkedStorages,
    loading,
    refetch: fetchData
  }
}
