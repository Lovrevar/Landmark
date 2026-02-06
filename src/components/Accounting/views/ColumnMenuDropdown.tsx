import React from 'react'
import { Columns, Check } from 'lucide-react'

interface ColumnMenuDropdownProps {
  showColumnMenu: boolean
  visibleColumns: Record<string, boolean>
  columnLabels: Record<string, string>
  onToggleMenu: () => void
  onToggleColumn: (column: string) => void
}

export const ColumnMenuDropdown: React.FC<ColumnMenuDropdownProps> = ({
  showColumnMenu,
  visibleColumns,
  columnLabels,
  onToggleMenu,
  onToggleColumn
}) => {
  return (
    <div className="relative column-menu-container">
      <button
        onClick={onToggleMenu}
        className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
      >
        <Columns className="w-5 h-5 mr-2" />
        Polja
      </button>
      {showColumnMenu && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700">Prikaži kolone</p>
          </div>
          {Object.entries(columnLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onToggleColumn(key)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
            >
              <span className="text-gray-700">{label}</span>
              {visibleColumns[key] && <Check className="w-4 h-4 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
