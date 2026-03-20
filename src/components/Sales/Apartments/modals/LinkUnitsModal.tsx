import React from 'react'
import { useTranslation } from 'react-i18next'
import { Warehouse, Package, X } from 'lucide-react'
import { ApartmentWithDetails } from '../types'
import { Modal, Button, LoadingSpinner } from '../../../ui'
import { useLinkUnits } from '../hooks/useLinkUnits'
import { useToast } from '../../../../contexts/ToastContext'

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
  const { t } = useTranslation()
  const toast = useToast()
  const {
    availableGarages,
    availableStorages,
    selectedGarageIds,
    selectedStorageIds,
    loading,
    saving,
    setSelectedGarageIds,
    setSelectedStorageIds,
    save
  } = useLinkUnits(
    apartment?.id ?? null,
    apartment?.building_id ?? null,
    visible && apartment !== null
  )

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
    try {
      await save()
      onLink()
      onClose()
    } catch (error) {
      console.error('Error saving unit links:', error)
      toast.error('Error saving unit links. Please try again.')
    }
  }

  if (!visible || !apartment) return null

  const selectedGarages = availableGarages.filter(g => selectedGarageIds.includes(g.id))
  const selectedStorages = availableStorages.filter(s => selectedStorageIds.includes(s.id))

  return (
    <Modal show={visible} onClose={onClose} size="xl">
      <Modal.Header
        title={t('apartments.link_units_modal.title')}
        subtitle={`${apartment.project_name} - ${apartment.building_name}`}
        onClose={onClose}
      />

      <Modal.Body>
        {loading ? (
          <LoadingSpinner message={t('apartments.link_units_modal.loading')} />
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">{t('apartments.link_units_modal.linked')}</h5>
              {selectedGarages.length === 0 && selectedStorages.length === 0 ? (
                <p className="text-sm text-gray-500">{t('apartments.link_units_modal.no_linked')}</p>
              ) : (
                <div className="space-y-1">
                  {selectedGarages.map(garage => (
                    <div key={garage.id} className="text-sm text-gray-700 flex items-center">
                      <Warehouse className="w-4 h-4 mr-2 text-orange-600" />
                      {t('common.garage')} {garage.number} - €{garage.price.toLocaleString('hr-HR')}
                    </div>
                  ))}
                  {selectedStorages.map(storage => (
                    <div key={storage.id} className="text-sm text-gray-700 flex items-center">
                      <Package className="w-4 h-4 mr-2 text-gray-600" />
                      {t('common.storage')} {storage.number} - €{storage.price.toLocaleString('hr-HR')}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Warehouse className="w-5 h-5 mr-2 text-orange-600" />
                {t('apartments.link_units_modal.select_garages')} ({selectedGarageIds.length})
              </h4>
              {availableGarages.length === 0 ? (
                <p className="text-gray-500 text-sm">{t('apartments.link_units_modal.no_garages')}</p>
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
                          <div className="font-medium text-gray-900">{t('common.garage')} {garage.number}</div>
                          {isSelected && <X className="w-4 h-4 text-orange-600" />}
                        </div>
                        <div className="text-sm text-gray-600">{t('common.floor')} {garage.floor} • {garage.size_m2}m²</div>
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
                {t('apartments.link_units_modal.select_storages')} ({selectedStorageIds.length})
              </h4>
              {availableStorages.length === 0 ? (
                <p className="text-gray-500 text-sm">{t('apartments.link_units_modal.no_storages')}</p>
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
                          <div className="font-medium text-gray-900">{t('common.storage')} {storage.number}</div>
                          {isSelected && <X className="w-4 h-4 text-gray-600" />}
                        </div>
                        <div className="text-sm text-gray-600">{t('common.floor')} {storage.floor} • {storage.size_m2}m²</div>
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
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('common.saving') : t('apartments.link_units_modal.save')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
