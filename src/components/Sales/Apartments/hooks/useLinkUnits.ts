import { useState, useEffect, useCallback } from 'react'
import {
  AvailableUnit,
  fetchLinkedUnitIds,
  fetchAvailableUnits,
  saveUnitLinks
} from '../services/linkUnitsService'

interface UseLinkUnitsResult {
  availableGarages: AvailableUnit[]
  availableStorages: AvailableUnit[]
  selectedGarageIds: string[]
  selectedStorageIds: string[]
  loading: boolean
  saving: boolean
  /**
   * The current links and the available units could not be read. Load-bearing: `save()`
   * writes the selection as the complete set, so saving on top of a failed load would
   * unlink everything the apartment already had.
   */
  error: Error | null
  refetch: () => Promise<void>
  setSelectedGarageIds: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedStorageIds: React.Dispatch<React.SetStateAction<string[]>>
  save: () => Promise<void>
}

export function useLinkUnits(
  apartmentId: string | null,
  buildingId: string | null,
  enabled: boolean
): UseLinkUnitsResult {
  const [availableGarages, setAvailableGarages] = useState<AvailableUnit[]>([])
  const [availableStorages, setAvailableStorages] = useState<AvailableUnit[]>([])
  const [selectedGarageIds, setSelectedGarageIds] = useState<string[]>([])
  const [selectedStorageIds, setSelectedStorageIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!apartmentId || !buildingId) return
    setLoading(true)
    setError(null)
    try {
      const [linkedIds, available] = await Promise.all([
        fetchLinkedUnitIds(apartmentId),
        fetchAvailableUnits(buildingId)
      ])
      setSelectedGarageIds(linkedIds.garageIds)
      setSelectedStorageIds(linkedIds.storageIds)
      setAvailableGarages(available.garages)
      setAvailableStorages(available.storages)
    } catch (err) {
      console.error('Error fetching units:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [apartmentId, buildingId])

  useEffect(() => {
    if (enabled) {
      fetchData()
    }
  }, [enabled, fetchData])

  const save = useCallback(async () => {
    if (!apartmentId) return
    setSaving(true)
    try {
      await saveUnitLinks(apartmentId, selectedGarageIds, selectedStorageIds)
    } finally {
      setSaving(false)
    }
  }, [apartmentId, selectedGarageIds, selectedStorageIds])

  return {
    availableGarages,
    availableStorages,
    selectedGarageIds,
    selectedStorageIds,
    loading,
    saving,
    error,
    refetch: fetchData,
    setSelectedGarageIds,
    setSelectedStorageIds,
    save
  }
}
