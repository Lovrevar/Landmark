import React from 'react'
import { UnitType } from '../../types'
import { getUnitIcon, getUnitLabel } from '../../icons'

interface UnitTypeTabsProps {
  activeType: UnitType
  onTypeChange: (type: UnitType) => void
  counts: {
    apartments: number
    garages: number
    repositories: number
  }
}

const unitTypes: UnitType[] = ['apartment', 'garage', 'repository']

export function UnitTypeTabs({ activeType, onTypeChange, counts }: UnitTypeTabsProps) {
  const getCount = (type: UnitType) => {
    switch (type) {
      case 'apartment':
        return counts.apartments
      case 'garage':
        return counts.garages
      case 'repository':
        return counts.repositories
    }
  }

  return (
    <div className="flex space-x-2 mb-6">
      {unitTypes.map((type) => {
        const Icon = getUnitIcon(type)
        const count = getCount(type)
        return (
          <button
            key={type}
            onClick={() => onTypeChange(type)}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              activeType === type
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            <Icon className="w-4 h-4 mr-2" />
            {getUnitLabel(type)}
            <span className="ml-2 px-2 py-0.5 bg-white rounded-full text-xs">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
