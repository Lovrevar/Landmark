import React from 'react'
import { CustomerCategory, CustomerCounts } from '../types/customerTypes'

interface CategoryTabsProps {
  activeCategory: CustomerCategory
  counts: CustomerCounts
  onCategoryChange: (category: CustomerCategory) => void
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  activeCategory,
  counts,
  onCategoryChange
}) => {
  const categories: { key: CustomerCategory; label: string; color: string }[] = [
    { key: 'interested', label: 'Interested', color: 'bg-blue-100 text-blue-800' },
    { key: 'reserved', label: 'Reserved', color: 'bg-yellow-100 text-yellow-800' },
    { key: 'contract', label: 'Contract', color: 'bg-orange-100 text-orange-800' },
    { key: 'sold', label: 'Sold', color: 'bg-green-100 text-green-800' }
  ]

  return (
    <div className="flex space-x-2 mb-6">
      {categories.map(({ key, label, color }) => (
        <button
          key={key}
          onClick={() => onCategoryChange(key)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
            activeCategory === key
              ? color
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {label} ({counts[key]})
        </button>
      ))}
    </div>
  )
}
