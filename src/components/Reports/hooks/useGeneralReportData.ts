import { format, subMonths } from 'date-fns'
import { fetchGeneralReportData } from '../services/generalReportService'
import { useCachedData } from '../../../lib/useCachedData'
import type { ComprehensiveReport } from '../types'

interface UseGeneralReportDataResult {
  report: ComprehensiveReport | null
  loading: boolean
  /** Epoch ms of when the currently-shown report was generated, or null. */
  fetchedAt: number | null
  /** Force a fresh fetch, bypassing the cache. */
  refetch: () => void
}

export function useGeneralReportData(): UseGeneralReportDataResult {
  const { data, loading, fetchedAt, refetch } = useCachedData<ComprehensiveReport>(
    'report:general',
    () => {
      const dateRange = {
        start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
      }
      return fetchGeneralReportData('all', dateRange)
    }
  )

  return { report: data, loading, fetchedAt, refetch }
}
