import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'

export function useAsyncExport<T extends unknown[]>(
  exportFn: (...args: T) => Promise<void>,
  errorMessageKey?: string
) {
  const [exporting, setExporting] = useState(false)
  const { t } = useTranslation()
  const toast = useToast()

  const run = async (...args: T) => {
    try {
      setExporting(true)
      await exportFn(...args)
    } catch (error) {
      console.error('Export failed:', error)
      if (errorMessageKey) toast.error(t(errorMessageKey))
    } finally {
      setExporting(false)
    }
  }

  return { exporting, run }
}
