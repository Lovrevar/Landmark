import React from 'react'
import { useTranslation } from 'react-i18next'
import { Columns, Check } from 'lucide-react'
import { Button } from '../../ui'

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
  const { t } = useTranslation()

  return (
    <div className="relative column-menu-container">
      <Button
        variant="secondary"
        icon={Columns}
        onClick={onToggleMenu}
      >
        {t('column_menu.button_label')}
      </Button>
      {showColumnMenu && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('column_menu.title')}</p>
          </div>
          {Object.entries(columnLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onToggleColumn(key)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between"
            >
              <span className="text-gray-700 dark:text-gray-200">{label}</span>
              {visibleColumns[key] && <Check className="w-4 h-4 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
