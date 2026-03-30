import React from 'react'
import { useTranslation } from 'react-i18next'
import { Warehouse, Package } from 'lucide-react'
import { Apartment } from '../../../../lib/supabase'
import { BuildingWithUnits } from '../types'
import { Button, Modal } from '../../../ui'

interface LinkingModalProps {
  visible: boolean
  apartment: Apartment | null
  building: BuildingWithUnits | null
  onClose: () => void
  onLinkGarage: (apartmentId: string, garageId: string) => void
  onLinkRepository: (apartmentId: string, repositoryId: string) => void
}

export const LinkingModal: React.FC<LinkingModalProps> = ({
  visible,
  apartment,
  building,
  onClose,
  onLinkGarage,
  onLinkRepository
}) => {
  const { t } = useTranslation()
  if (!visible || !apartment || !building) return null

  const availableGarages = building.garages.filter(g => g.status === 'Available')
  const availableRepositories = building.repositories.filter(r => r.status === 'Available')

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header title={`${t('sales_projects.linking_modal.title')} ${apartment.number}`} onClose={onClose} />
      <Modal.Body>
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <Warehouse className="w-5 h-5 mr-2 text-orange-600" />
              {t('sales_projects.linking_modal.link_garage')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {availableGarages.map((garage) => (
                <button
                  key={garage.id}
                  onClick={() => {
                    onLinkGarage(apartment.id, garage.id)
                    onClose()
                  }}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    apartment.linked_garages?.some(g => g.id === garage.id)
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-orange-300 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{t('common.garage')} {garage.number}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('sales_projects.linking_modal.floor')} {garage.floor} • {garage.size_m2}m²</div>
                  <div className="text-sm font-medium text-orange-600">€{garage.price.toLocaleString('hr-HR')}</div>
                </button>
              ))}
              {availableGarages.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 col-span-2">{t('sales_projects.linking_modal.no_garages')}</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <Package className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
              {t('sales_projects.linking_modal.link_repository')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {availableRepositories.map((repository) => (
                <button
                  key={repository.id}
                  onClick={() => {
                    onLinkRepository(apartment.id, repository.id)
                    onClose()
                  }}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    apartment.linked_repositories?.some(r => r.id === repository.id)
                      ? 'border-gray-500 bg-gray-50 dark:bg-gray-700/50'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{t('common.storage')} {repository.number}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('sales_projects.linking_modal.floor')} {repository.floor} • {repository.size_m2}m²</div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">€{repository.price.toLocaleString('hr-HR')}</div>
                </button>
              ))}
              {availableRepositories.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 col-span-2">{t('sales_projects.linking_modal.no_repositories')}</p>
              )}
            </div>
          </div>

      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>
          {t('common.close')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
