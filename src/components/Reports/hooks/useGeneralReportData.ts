import { format, subMonths } from 'date-fns'
import { fetchGeneralReportData } from '../services/generalReportService'
import { useCachedData } from '../../../lib/useCachedData'
import type { ComprehensiveReport } from '../types'

interface UseGeneralReportDataResult {
  report: ComprehensiveReport | null
  loading: boolean
  /**
   * The failure from the last fetch, or null. The page must tell a failed load apart from an
   * empty portfolio: this report drives an executive PDF, and a dropped query rendered as
   * "€0 revenue" reads as a business fact rather than as a missing answer.
   */
  error: Error | null
  /** Epoch ms of when the currently-shown report was generated, or null. */
  fetchedAt: number | null
  /** Force a fresh fetch, bypassing the cache. */
  refetch: () => void
}

export function useGeneralReportData(): UseGeneralReportDataResult {
  const { data, loading, error, fetchedAt, refetch } = useCachedData<ComprehensiveReport>(
    'report:general',
    () => {
      const dateRange = {
        start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
      }
      return fetchGeneralReportData('all', dateRange)
    }
  )

  return { report: data, loading, error, fetchedAt, refetch }
}
