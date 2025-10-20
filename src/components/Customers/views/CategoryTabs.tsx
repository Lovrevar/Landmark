import React from 'react'
import { Users, Flame, MessageSquare, CheckCircle, UserX } from 'lucide-react'
import { CustomerCategory, CustomerCounts } from '../types/customerTypes'

interface CategoryTabsProps {
  activeCategory: CustomerCategory
  counts: CustomerCounts
  onCategoryChange: (category: CustomerCategory) => void
}

const categories = [
  { id: 'interested' as CustomerCategory, label: 'Interested', icon: Users, color: 'blue' },
  { id: 'hot_lead' as CustomerCategory, label: 'Hot Leads', icon: Flame, color: 'red' },
  { id: 'negotiating' as CustomerCategory, label: 'Negotiating', icon: MessageSquare, color: 'yellow' },
  { id: 'buyer' as CustomerCategory, label: 'Buyers', icon: CheckCircle, color: 'green' },
  { id: 'backed_out' as CustomerCategory, label: 'Backed Out', icon: UserX, color: 'gray' }
]

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ activeCategory, counts, onCategoryChange }) => {
  return (
    <div className="flex space-x-2 overflow-x-auto pb-2">
      {categories.map((category) => {
        const Icon = category.icon
        const isActive = activeCategory === category.id
        const count = counts[category.id]

        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`flex items-center px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              isActive
                ? `bg-${category.color}-600 text-white shadow-md`
                : `bg-white text-gray-700 hover:bg-${category.color}-50 border border-gray-200`
            }`}
          >
            <Icon className="w-5 h-5 mr-2" />
            {category.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
              isActive ? 'bg-white bg-opacity-30' : `bg-${category.color}-100 text-${category.color}-700`
            }`}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
