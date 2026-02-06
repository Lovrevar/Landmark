import React from 'react'

interface Tab<T extends string> {
  id: T
  label: string
  icon?: React.ReactNode
  count?: number
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[]
  activeTab: T
  onChange: (tabId: T) => void
  className?: string
}

export default function Tabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  className = '',
}: TabsProps<T>) {
  return (
    <div className={`border-b border-gray-200 ${className}`}>
      <nav className="flex gap-1" aria-label="Tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
