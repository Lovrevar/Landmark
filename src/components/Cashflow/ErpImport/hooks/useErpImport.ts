import { useCallback, useEffect, useState } from 'react'
import type { FeedName, ImportRun, StagingProblem, UploadResult } from '../types'
import { fetchImportRuns, fetchRunProblems, uploadFeedFile } from '../services/erpImportService'

export function useErpImport() {
  const [runs, setRuns] = useState<ImportRun[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [feed, setFeed] = useState<FeedName>('accounts')
  const [lastResult, setLastResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [problems, setProblems] = useState<StagingProblem[]>([])
  const [problemsLoading, setProblemsLoading] = useState(false)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    try {
      setRuns(await fetchImportRuns())
    } catch (e) {
      console.error('Error loading import runs:', e)
      setError(e instanceof Error ? e.message : 'Failed to load import runs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadRuns() }, [loadRuns])

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setLastResult(null)
    try {
      const result = await uploadFeedFile(feed, file)
      setLastResult(result)
      await loadRuns()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [feed, loadRuns])

  const toggleProblems = useCallback(async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null)
      setProblems([])
      return
    }
    setExpandedRunId(runId)
    setProblemsLoading(true)
    try {
      setProblems(await fetchRunProblems(runId))
    } catch (e) {
      console.error('Error loading run problems:', e)
      setProblems([])
    } finally {
      setProblemsLoading(false)
    }
  }, [expandedRunId])

  return {
    runs, loading, uploading, feed, setFeed, lastResult, error,
    upload, reload: loadRuns,
    expandedRunId, problems, problemsLoading, toggleProblems,
  }
}
