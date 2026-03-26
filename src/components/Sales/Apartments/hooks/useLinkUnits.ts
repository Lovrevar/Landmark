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

  const fetchData = useCallback(async () => {
    if (!apartmentId || !buildingId) return
    setLoading(true)
    try {
      const [linkedIds, available] = await Promise.all([
        fetchLinkedUnitIds(apartmentId),
        fetchAvailableUnits(buildingId)
      ])
      setSelectedGarageIds(linkedIds.garageIds)
      setSelectedStorageIds(linkedIds.storageIds)
      setAvailableGarages(available.garages)
      setAvailableStorages(available.storages)
    } catch (error) {
      console.error('Error fetching units:', error)
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
    setSelectedGarageIds,
    setSelectedStorageIds,
    save
  }
}
