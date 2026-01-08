import React, { useState, useEffect } from 'react'
import { X, Warehouse, Package, Link as LinkIcon } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { ApartmentWithDetails } from '../types/apartmentTypes'

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
  const [garages, setGarages] = useState<any[]>([])
  const [storages, setStorages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible && apartment) {
      fetchAvailableUnits()
    }
  }, [visible, apartment])

  const fetchAvailableUnits = async () => {
    if (!apartment?.building_id) return

    setLoading(true)
    try {
      const { data: garagesData } = await supabase
        .from('garages')
        .select('*')
        .eq('building_id', apartment.building_id)
        .eq('status', 'Available')
        .order('number')

      const { data: storagesData } = await supabase
        .from('repositories')
        .select('*')
        .eq('building_id', apartment.building_id)
        .eq('status', 'Available')
        .order('number')

      setGarages(garagesData || [])
      setStorages(storagesData || [])
    } catch (error) {
      console.error('Error fetching units:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLinkGarage = async (garageId: string) => {
    if (!apartment) return

    try {
      const { error } = await supabase
        .from('apartments')
        .update({ garage_id: garageId })
        .eq('id', apartment.id)

      if (error) throw error

      onLink()
      onClose()
    } catch (error) {
      console.error('Error linking garage:', error)
    }
  }

  const handleLinkStorage = async (storageId: string) => {
    if (!apartment) return

    try {
      const { error } = await supabase
        .from('apartments')
        .update({ repository_id: storageId })
        .eq('id', apartment.id)

      if (error) throw error

      onLink()
      onClose()
    } catch (error) {
      console.error('Error linking storage:', error)
    }
  }

  if (!visible || !apartment) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                <LinkIcon className="w-5 h-5 mr-2 text-blue-600" />
                Link Units to Apartment {apartment.number}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {apartment.project_name} - {apartment.building_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading available units...
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Warehouse className="w-5 h-5 mr-2 text-orange-600" />
                  Link Garage
                </h4>
                {garages.length === 0 ? (
                  <p className="text-gray-500 text-sm">No available garages in this building</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {garages.map((garage) => (
                      <button
                        key={garage.id}
                        onClick={() => handleLinkGarage(garage.id)}
                        className="p-3 border-2 border-gray-200 rounded-lg text-left transition-all hover:border-orange-400 hover:bg-orange-50"
                      >
                        <div className="font-medium text-gray-900">Garage {garage.number}</div>
                        <div className="text-sm text-gray-600">Floor {garage.floor} • {garage.size_m2}m²</div>
                        <div className="text-sm font-medium text-orange-600">€{garage.price.toLocaleString('hr-HR')}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-gray-600" />
                  Link Storage
                </h4>
                {storages.length === 0 ? (
                  <p className="text-gray-500 text-sm">No available storages in this building</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {storages.map((storage) => (
                      <button
                        key={storage.id}
                        onClick={() => handleLinkStorage(storage.id)}
                        className="p-3 border-2 border-gray-200 rounded-lg text-left transition-all hover:border-gray-400 hover:bg-gray-50"
                      >
                        <div className="font-medium text-gray-900">Storage {storage.number}</div>
                        <div className="text-sm text-gray-600">Floor {storage.floor} • {storage.size_m2}m²</div>
                        <div className="text-sm font-medium text-gray-600">€{storage.price.toLocaleString('hr-HR')}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
