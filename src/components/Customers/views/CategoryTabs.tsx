import React from 'react'
import { Users, Flame, MessageSquare, CheckCircle, UserX } from 'lucide-react'
import { CustomerCategory, CustomerCounts } from '../types/customerTypes'

type ActiveCategory = CustomerCategory | null

interface CategoryTabsProps {
  activeCategory: ActiveCategory
  counts: CustomerCounts
  onCategoryChange: (category: ActiveCategory) => void
}

const categories = [
  { id: 'interested' as CustomerCategory, label: 'Interested', icon: Users, activeClass: 'bg-blue-600 text-white shadow-md', hoverClass: 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200', badgeActive: 'bg-white bg-opacity-30 text-white', badgeInactive: 'bg-blue-100 text-blue-700' },
  { id: 'hot_lead' as CustomerCategory, label: 'Hot Leads', icon: Flame, activeClass: 'bg-red-600 text-white shadow-md', hoverClass: 'bg-white text-gray-700 hover:bg-red-50 border border-gray-200', badgeActive: 'bg-white bg-opacity-30 text-white', badgeInactive: 'bg-red-100 text-red-700' },
  { id: 'negotiating' as CustomerCategory, label: 'Negotiating', icon: MessageSquare, activeClass: 'bg-yellow-500 text-white shadow-md', hoverClass: 'bg-white text-gray-700 hover:bg-yellow-50 border border-gray-200', badgeActive: 'bg-white bg-opacity-30 text-white', badgeInactive: 'bg-yellow-100 text-yellow-700' },
  { id: 'buyer' as CustomerCategory, label: 'Buyers', icon: CheckCircle, activeClass: 'bg-green-600 text-white shadow-md', hoverClass: 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200', badgeActive: 'bg-white bg-opacity-30 text-white', badgeInactive: 'bg-green-100 text-green-700' },
  { id: 'backed_out' as CustomerCategory, label: 'Backed Out', icon: UserX, activeClass: 'bg-gray-600 text-white shadow-md', hoverClass: 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200', badgeActive: 'bg-white bg-opacity-30 text-white', badgeInactive: 'bg-gray-100 text-gray-700' }
]

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ activeCategory, counts, onCategoryChange }) => {
  const handleClick = (id: CustomerCategory) => {
    onCategoryChange(activeCategory === id ? null : id)
  }

  return (
    <div className="flex space-x-2 overflow-x-auto pb-2">
      {categories.map((category) => {
        const Icon = category.icon
        const isActive = activeCategory === category.id
        const count = counts[category.id]

        return (
          <button
            key={category.id}
            onClick={() => handleClick(category.id)}
            className={`flex items-center px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              isActive ? category.activeClass : category.hoverClass
            }`}
          >
            <Icon className="w-5 h-5 mr-2" />
            {category.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
              isActive ? category.badgeActive : category.badgeInactive
            }`}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
