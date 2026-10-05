import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { articlesForRoute, isVisibleToRole, type HelpArticle } from '../../../lib/helpKb'
import { canRoleAccessRoute } from '../../../utils/routeAccess'
import { loadHelpArticles } from '../services/helpArticles'

/** The help articles for the signed-in user: written for their role, or about a page they can open. */
export function useHelpArticles() {
  const { user } = useAuth()
  const [all, setAll] = useState<HelpArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAll(await loadHelpArticles())
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const articles = useMemo(() => all.filter(article => isVisibleToRole(article, user?.role, canRoleAccessRoute)), [all, user?.role])

  return { articles, loading, error, refetch }
}

/**
 * How many articles exist for a page, for the "?" link in `PageHeader`. Zero while loading and
 * when the load fails: the link is an extra, and a page must not show an error because its help
 * could not be counted.
 */
export function useHelpArticleCount(pathname: string): number {
  const { articles } = useHelpArticles()
  return useMemo(() => articlesForRoute(articles, pathname).length, [articles, pathname])
}
