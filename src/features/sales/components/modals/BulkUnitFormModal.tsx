import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { BulkCreateConfig, UnitType } from '../../types'
import { getUnitLabel, getUnitPrefix } from '../../icons'
import { calculateBulkPreview } from '../../utils'

interface BulkUnitFormModalProps {
  isOpen: boolean
  unitType: UnitType
  onClose: () => void
  onSubmit: (config: BulkCreateConfig) => void
}

const initialConfig: BulkCreateConfig = {
  floor_start: 1,
  floor_end: 10,
  units_per_floor: 4,
  base_size: 85,
  size_variation: 15,
  base_price_per_m2: 5000,
  floor_increment: 10000,
  number_prefix: ''
}

export function BulkUnitFormModal({ isOpen, unitType, onClose, onSubmit }: BulkUnitFormModalProps) {
  const [config, setConfig] = useState<BulkCreateConfig>(initialConfig)

  useEffect(() => {
    if (!isOpen) {
      setConfig(initialConfig)
    }
  }, [isOpen])

  if (!isOpen) return null

  const preview = calculateBulkPreview(config)
  const defaultPrefix = getUnitPrefix(unitType)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              Bulk Create {getUnitLabel(unitType)}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Floor</label>
              <input
                type="number"
                min="0"
                value={config.floor_start}
                onChange={(e) => setConfig({ ...config, floor_start: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Floor</label>
              <input
                type="number"
                min="0"
                value={config.floor_end}
                onChange={(e) => setConfig({ ...config, floor_end: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Units per Floor</label>
              <input
                type="number"
                min="1"
                value={config.units_per_floor}
                onChange={(e) => setConfig({ ...config, units_per_floor: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number Prefix (optional)
              </label>
              <input
                type="text"
                value={config.number_prefix}
                onChange={(e) => setConfig({ ...config, number_prefix: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={defaultPrefix}
              />
              <p className="text-xs text-gray-500 mt-1">
                Default: {defaultPrefix} (e.g., {defaultPrefix}101, {defaultPrefix}202)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Base Size (m²)</label>
              <input
                type="number"
                min="0"
                value={config.base_size}
                onChange={(e) => setConfig({ ...config, base_size: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Size Variation (±m²)</label>
              <input
                type="number"
                min="0"
                value={config.size_variation}
                onChange={(e) => setConfig({ ...config, size_variation: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Base Price per m²</label>
              <input
                type="number"
                min="0"
                value={config.base_price_per_m2}
                onChange={(e) => setConfig({ ...config, base_price_per_m2: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Floor Premium (€)</label>
              <input
                type="number"
                min="0"
                value={config.floor_increment}
                onChange={(e) => setConfig({ ...config, floor_increment: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Additional price per floor above start floor
              </p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">Preview</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Total {getUnitLabel(unitType)}:</span>
                <span className="font-medium text-blue-900 ml-2">{preview.totalUnits}</span>
              </div>
              <div>
                <span className="text-blue-700">Avg. Size:</span>
                <span className="font-medium text-blue-900 ml-2">{preview.avgSize} m²</span>
              </div>
              <div>
                <span className="text-blue-700">Avg. Price:</span>
                <span className="font-medium text-blue-900 ml-2">
                  €{Math.round(preview.avgPrice).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-blue-700">Total Value:</span>
                <span className="font-medium text-blue-900 ml-2">
                  €{Math.round(preview.totalValue).toLocaleString()}
                </span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-3">
              Units will be numbered: {config.number_prefix || defaultPrefix}
              {config.floor_start}01, {config.number_prefix || defaultPrefix}
              {config.floor_start}02, etc.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(config)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Create {preview.totalUnits} {getUnitLabel(unitType)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
