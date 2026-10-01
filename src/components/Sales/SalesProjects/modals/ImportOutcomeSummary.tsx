import React from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { classifyImportOutcome, MAX_LISTED_IMPORT_ERRORS } from '../importOutcome'

interface ImportOutcomeSummaryProps {
  succeeded: number
  failed: number
  /** Per-row error messages; the first MAX_LISTED_IMPORT_ERRORS are listed. */
  errors: string[]
}

/** Step-3 headline and error list shared by the apartment and garage Excel imports. */
export const ImportOutcomeSummary: React.FC<ImportOutcomeSummaryProps> = ({ succeeded, failed, errors }) => {
  const { t } = useTranslation()
  const outcome = classifyImportOutcome(succeeded, failed)

  const { Icon, iconClass, headline } =
    outcome === 'nothing_imported'
      ? { Icon: XCircle, iconClass: 'text-red-600 dark:text-red-400', headline: t('sales_projects.excel_import.nothing_imported') }
      : outcome === 'partial'
        ? { Icon: AlertTriangle, iconClass: 'text-amber-500 dark:text-amber-400', headline: t('sales_projects.excel_import.completed_with_errors') }
        : { Icon: CheckCircle, iconClass: 'text-green-600 dark:text-green-400', headline: t('sales_projects.excel_import.import_complete') }

  const listed = errors.slice(0, MAX_LISTED_IMPORT_ERRORS)
  const hidden = errors.length - listed.length

  return (
    <>
      <div className="text-center py-8" role="status">
        <Icon className={`w-16 h-16 mx-auto mb-4 ${iconClass}`} aria-hidden="true" />
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{headline}</h3>
      </div>

      {listed.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h4 className="font-medium text-red-900 dark:text-red-300 mb-2">
            {t('sales_projects.excel_import.errors_heading')}
          </h4>
          <ul className="space-y-1 text-sm text-red-700 dark:text-red-400 break-words">
            {listed.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {t('sales_projects.excel_import.more_errors', { count: hidden })}
            </p>
          )}
        </div>
      )}
    </>
  )
}
