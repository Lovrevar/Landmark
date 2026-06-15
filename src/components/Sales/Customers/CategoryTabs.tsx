import React from 'react'
import { useTranslation } from 'react-i18next'
import { Users, UserPlus, CheckCircle } from 'lucide-react'
import { CustomerCategory, CustomerCounts } from './types'

type ActiveCategory = CustomerCategory | null

interface CategoryTabsProps {
  activeCategory: ActiveCategory
  counts: CustomerCounts
  onCategoryChange: (category: ActiveCategory) => void
}

const categories = [
  { id: 'lead' as CustomerCategory, labelKey: 'customers.tabs.leads', icon: UserPlus, activeClass: 'bg-amber-500 text-white shadow-md', hoverClass: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-gray-200 dark:border-gray-700', badgeActive: 'bg-white bg-opacity-30 text-white', badgeInactive: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  { id: 'interested' as CustomerCategory, labelKey: 'customers.tabs.interested', icon: Users, activeClass: 'bg-blue-600 text-white shadow-md', hoverClass: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-700', badgeActive: 'bg-white bg-opacity-30 text-white', badgeInactive: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  { id: 'buyer' as CustomerCategory, labelKey: 'customers.tabs.buyers', icon: CheckCircle, activeClass: 'bg-green-600 text-white shadow-md', hoverClass: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/20 border border-gray-200 dark:border-gray-700', badgeActive: 'bg-white bg-opacity-30 text-white', badgeInactive: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' }
]

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ activeCategory, counts, onCategoryChange }) => {
  const { t } = useTranslation()
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
            {t(category.labelKey)}
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
