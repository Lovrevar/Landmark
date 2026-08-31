import { useCallback, useEffect, useState } from 'react'
import type { FeedName, ImportRun, ReviewItem, StagingProblem, UploadResult } from '../types'
import {
  fetchImportRuns, fetchReviewQueue, fetchRunProblems, reclassifyRun, uploadFeedFile,
} from '../services/erpImportService'

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

  const [review, setReview] = useState<ReviewItem[]>([])
  const [reclassifying, setReclassifying] = useState<string | null>(null)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    try {
      const [r, q] = await Promise.all([fetchImportRuns(), fetchReviewQueue()])
      setRuns(r)
      setReview(q)
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

  const reclassify = useCallback(async (runId: string) => {
    setReclassifying(runId)
    setError(null)
    try {
      await reclassifyRun(runId)
      await loadRuns()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reclassification failed')
    } finally {
      setReclassifying(null)
    }
  }, [loadRuns])

  return {
    runs, loading, uploading, feed, setFeed, lastResult, error,
    upload, reload: loadRuns,
    expandedRunId, problems, problemsLoading, toggleProblems,
    review, reclassify, reclassifying,
  }
}
