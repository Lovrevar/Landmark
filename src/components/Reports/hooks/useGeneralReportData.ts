import { useState, useEffect, useCallback } from 'react'
import { format, subMonths } from 'date-fns'
import { fetchGeneralReportData } from '../services/generalReportService'
import type { ComprehensiveReport } from '../types'

interface UseGeneralReportDataResult {
  report: ComprehensiveReport | null
  loading: boolean
  refetch: () => void
}

export function useGeneralReportData(): UseGeneralReportDataResult {
  const [report, setReport] = useState<ComprehensiveReport | null>(null)
  const [loading, setLoading] = useState(true)

  const selectedProject = 'all'
  const dateRange = {
    start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const reportData = await fetchGeneralReportData(selectedProject, dateRange)
      setReport(reportData)
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { report, loading, refetch: load }
}
