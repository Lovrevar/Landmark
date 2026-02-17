import React, { useState, useEffect } from 'react'
import { Warehouse, Package, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { ApartmentWithDetails } from '../types/apartmentTypes'
import { Modal, Button, LoadingSpinner } from '../../ui'

interface LinkUnitsModalProps {
  visible: boolean
  onClose: () => void
  apartment: ApartmentWithDetails | null
  onLink: () => void
}

export const LinkUnitsModal: React.FC<LinkUnitsModalProps> = ({
  visible,
  onClose,
  apartment,
  onLink
}) => {
  const [availableGarages, setAvailableGarages] = useState<any[]>([])
  const [availableStorages, setAvailableStorages] = useState<any[]>([])
  const [selectedGarageIds, setSelectedGarageIds] = useState<string[]>([])
  const [selectedStorageIds, setSelectedStorageIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible && apartment) {
      fetchData()
    }
  }, [visible, apartment])

  const fetchData = async () => {
    if (!apartment?.building_id) return

    setLoading(true)
    try {
      const { data: linkedGarageData } = await supabase
        .from('apartment_garages')
        .select('garage_id')
        .eq('apartment_id', apartment.id)

      const { data: linkedStorageData } = await supabase
        .from('apartment_repositories')
        .select('repository_id')
        .eq('apartment_id', apartment.id)

      const linkedGarageIds = linkedGarageData?.map(lg => lg.garage_id) || []
      const linkedStorageIds = linkedStorageData?.map(ls => ls.repository_id) || []

      setSelectedGarageIds(linkedGarageIds)
      setSelectedStorageIds(linkedStorageIds)

      const { data: garagesData } = await supabase
        .from('garages')
        .select('*')
        .eq('building_id', apartment.building_id)
        .order('number')

      const { data: storagesData } = await supabase
        .from('repositories')
        .select('*')
        .eq('building_id', apartment.building_id)
        .order('number')

      setAvailableGarages(garagesData || [])
      setAvailableStorages(storagesData || [])
    } catch (error) {
      console.error('Error fetching units:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleGarage = (garageId: string) => {
    setSelectedGarageIds(prev =>
      prev.includes(garageId)
        ? prev.filter(id => id !== garageId)
        : [...prev, garageId]
    )
  }

  const toggleStorage = (storageId: string) => {
    setSelectedStorageIds(prev =>
      prev.includes(storageId)
        ? prev.filter(id => id !== storageId)
        : [...prev, storageId]
    )
  }

  const handleSave = async () => {
    if (!apartment) return

    setSaving(true)
    try {
      await supabase
        .from('apartment_garages')
        .delete()
        .eq('apartment_id', apartment.id)

      await supabase
        .from('apartment_repositories')
        .delete()
        .eq('apartment_id', apartment.id)

      if (selectedGarageIds.length > 0) {
        const garageLinks = selectedGarageIds.map(garageId => ({
          apartment_id: apartment.id,
          garage_id: garageId
        }))

        const { error: garageError } = await supabase
          .from('apartment_garages')
          .insert(garageLinks)

        if (garageError) throw garageError
      }

      if (selectedStorageIds.length > 0) {
        const storageLinks = selectedStorageIds.map(storageId => ({
          apartment_id: apartment.id,
          repository_id: storageId
        }))

        const { error: storageError } = await supabase
          .from('apartment_repositories')
          .insert(storageLinks)

        if (storageError) throw storageError
      }

      onLink()
      onClose()
    } catch (error) {
      console.error('Error saving unit links:', error)
      alert('Error saving unit links. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!visible || !apartment) return null

  const selectedGarages = availableGarages.filter(g => selectedGarageIds.includes(g.id))
  const selectedStorages = availableStorages.filter(s => selectedStorageIds.includes(s.id))

  return (
    <Modal show={visible} onClose={onClose} size="xl">
      <Modal.Header
        title={`Link Units to Apartment ${apartment.number}`}
        subtitle={`${apartment.project_name} - ${apartment.building_name}`}
        onClose={onClose}
      />

      <Modal.Body>
        {loading ? (
          <LoadingSpinner message="Loading available units..." />
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Currently Linked Units</h5>
              {selectedGarages.length === 0 && selectedStorages.length === 0 ? (
                <p className="text-sm text-gray-500">No units linked</p>
              ) : (
                <div className="space-y-1">
                  {selectedGarages.map(garage => (
                    <div key={garage.id} className="text-sm text-gray-700 flex items-center">
                      <Warehouse className="w-4 h-4 mr-2 text-orange-600" />
                      Garage {garage.number} - €{garage.price.toLocaleString('hr-HR')}
                    </div>
                  ))}
                  {selectedStorages.map(storage => (
                    <div key={storage.id} className="text-sm text-gray-700 flex items-center">
                      <Package className="w-4 h-4 mr-2 text-gray-600" />
                      Storage {storage.number} - €{storage.price.toLocaleString('hr-HR')}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Warehouse className="w-5 h-5 mr-2 text-orange-600" />
                Select Garages ({selectedGarageIds.length} selected)
              </h4>
              {availableGarages.length === 0 ? (
                <p className="text-gray-500 text-sm">No garages available in this building</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {availableGarages.map((garage) => {
                    const isSelected = selectedGarageIds.includes(garage.id)
                    const isAvailable = garage.status === 'Available' || isSelected

                    return (
                      <button
                        key={garage.id}
                        onClick={() => isAvailable && toggleGarage(garage.id)}
                        disabled={!isAvailable}
                        className={`p-3 border-2 rounded-lg text-left transition-all ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50'
                            : isAvailable
                              ? 'border-gray-200 hover:border-orange-400 hover:bg-orange-50'
                              : 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900">Garage {garage.number}</div>
                          {isSelected && <X className="w-4 h-4 text-orange-600" />}
                        </div>
                        <div className="text-sm text-gray-600">Floor {garage.floor} • {garage.size_m2}m²</div>
                        <div className="text-sm font-medium text-orange-600">€{garage.price.toLocaleString('hr-HR')}</div>
                        {!isAvailable && <div className="text-xs text-gray-500 mt-1">{garage.status}</div>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Package className="w-5 h-5 mr-2 text-gray-600" />
                Select Storages ({selectedStorageIds.length} selected)
              </h4>
              {availableStorages.length === 0 ? (
                <p className="text-gray-500 text-sm">No storages available in this building</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {availableStorages.map((storage) => {
                    const isSelected = selectedStorageIds.includes(storage.id)
                    const isAvailable = storage.status === 'Available' || isSelected

                    return (
                      <button
                        key={storage.id}
                        onClick={() => isAvailable && toggleStorage(storage.id)}
                        disabled={!isAvailable}
                        className={`p-3 border-2 rounded-lg text-left transition-all ${
                          isSelected
                            ? 'border-gray-500 bg-gray-50'
                            : isAvailable
                              ? 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                              : 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900">Storage {storage.number}</div>
                          {isSelected && <X className="w-4 h-4 text-gray-600" />}
                        </div>
                        <div className="text-sm text-gray-600">Floor {storage.floor} • {storage.size_m2}m²</div>
                        <div className="text-sm font-medium text-gray-600">€{storage.price.toLocaleString('hr-HR')}</div>
                        {!isAvailable && <div className="text-xs text-gray-500 mt-1">{storage.status}</div>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Links'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
