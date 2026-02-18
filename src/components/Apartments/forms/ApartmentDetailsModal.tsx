import React from 'react'
import { ApartmentWithDetails } from '../types/apartmentTypes'
import { Modal, Badge, Button } from '../../ui'

interface ApartmentDetailsModalProps {
  visible: boolean
  onClose: () => void
  apartment: ApartmentWithDetails | null
}

export const ApartmentDetailsModal: React.FC<ApartmentDetailsModalProps> = ({
  visible,
  onClose,
  apartment
}) => {
  if (!visible || !apartment) return null

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header title="Apartment Details" onClose={onClose} />

      <Modal.Body>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Apartment Number</p>
              <p className="text-lg font-semibold text-gray-900">{apartment.number}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <Badge variant={
                apartment.status === 'Sold' ? 'green' :
                apartment.status === 'Reserved' ? 'yellow' :
                'blue'
              }>
                {apartment.status}
              </Badge>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Location</h4>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Project:</span>
                <span className="font-medium text-gray-900">{apartment.project_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Building:</span>
                <span className="font-medium text-gray-900">{apartment.building_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Floor (Etaža):</span>
                <span className="font-medium text-gray-900">{apartment.floor}</span>
              </div>
              {apartment.ulaz && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Entrance (Ulaz):</span>
                  <span className="font-medium text-gray-900">{apartment.ulaz}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Specifications</h4>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {apartment.tip_stana && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Type (Tip stana):</span>
                  <span className="font-medium text-gray-900">{apartment.tip_stana}</span>
                </div>
              )}
              {apartment.sobnost != null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Rooms (Sobnost):</span>
                  <span className="font-medium text-gray-900">{apartment.sobnost}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Saleable Area:</span>
                <span className="font-medium text-gray-900">{apartment.size_m2} m²</span>
              </div>
              {apartment.povrsina_otvoreno != null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Open Area (Površina otvoreno):</span>
                  <span className="font-medium text-gray-900">{apartment.povrsina_otvoreno} m²</span>
                </div>
              )}
              {apartment.povrsina_ot_sa_koef != null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Open Area w/ Coef.:</span>
                  <span className="font-medium text-gray-900">{apartment.povrsina_ot_sa_koef} m²</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Price:</span>
                <span className="font-bold text-green-600">€{apartment.price.toLocaleString('hr-HR')}</span>
              </div>
            </div>
          </div>

          {apartment.buyer_name && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Buyer Information</h4>
              <div className="flex justify-between">
                <span className="text-gray-600">Buyer:</span>
                <span className="font-medium text-gray-900">{apartment.buyer_name}</span>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  )
}
