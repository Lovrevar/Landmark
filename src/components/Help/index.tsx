import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookOpen, FileQuestion, SearchX } from 'lucide-react'
import { Alert, Card, EmptyState, ErrorState, LoadingSpinner, PageHeader, SearchInput } from '../ui'
import MarkdownView from '../ui/MarkdownView'
import {
  articlesForRoute,
  helpArticlePath,
  helpGroup,
  resolveWikiLinks,
  searchArticles,
  type HelpArticle,
  type HelpGroup,
} from '../../lib/helpKb'
import { logHelpEvent } from '../../lib/helpEvents'
import { useHelpArticles } from './hooks/useHelpArticles'

const GROUP_ORDER: HelpGroup[] = ['pages', 'terms', 'roles']

const ArticleList: React.FC<{ articles: HelpArticle[] }> = ({ articles }) => (
  <ul className="divide-y divide-gray-100 dark:divide-gray-700">
    {articles.map(article => (
      <li key={article.id}>
        <Link
          to={helpArticlePath(article.id)}
          className="block py-2 text-sm text-blue-700 dark:text-blue-300 hover:underline"
        >
          {article.title}
        </Link>
      </li>
    ))}
  </ul>
)

const HelpPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { articleId } = useParams<{ articleId?: string }>()
  const [searchParams] = useSearchParams()
  const fromPage = searchParams.get('page')
  const [query, setQuery] = useState('')
  const { articles, loading, error, refetch } = useHelpArticles()

  // One entry per thing looked at: the index (with the page that sent the user here, if any) or
  // a single article.
  useEffect(() => {
    logHelpEvent({ action: 'help.view', articleId: articleId ?? null, fromPage })
  }, [articleId, fromPage])

  const titles = useMemo(() => new Map(articles.map(article => [article.id, article.title])), [articles])
  const forPage = useMemo(() => (fromPage ? articlesForRoute(articles, fromPage) : []), [articles, fromPage])
  const results = useMemo(() => searchArticles(articles, query), [articles, query])
  const searching = query.trim() !== ''

  // The articles are written in Croatian only; say so rather than leave an English reader guessing.
  const languageNote = i18n.language.startsWith('hr') ? null : (
    <Alert variant="info">{t('help.croatian_only_note')}</Alert>
  )

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorState onRetry={() => void refetch()} />

  if (articleId) {
    const article = articles.find(candidate => candidate.id === articleId)
    return (
      <div className="space-y-4 max-w-3xl">
        <Link to="/help" className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {t('help.back_to_all')}
        </Link>
        {article ? (
          <>
            <PageHeader title={article.title} />
            {languageNote}
            <Card padding="lg">
              <MarkdownView content={resolveWikiLinks(article.body, titles)} />
            </Card>
          </>
        ) : (
          <EmptyState
            icon={FileQuestion}
            title={t('help.article_unavailable_title')}
            description={t('help.article_unavailable_description')}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader title={t('help.title')} description={t('help.description')} />
      {languageNote}
      <SearchInput
        value={query}
        onChange={e => setQuery(e.target.value)}
        onClear={() => setQuery('')}
        placeholder={t('help.search_placeholder')}
        aria-label={t('help.search_placeholder')}
      />

      {searching ? (
        results.length === 0 ? (
          <EmptyState icon={SearchX} title={t('help.no_results_title')} description={t('help.no_results_description')} />
        ) : (
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('help.results_count', { count: results.length })}</p>
            <ArticleList articles={results} />
          </Card>
        )
      ) : (
        <>
          {forPage.length > 0 && (
            <Card className="border-blue-200 dark:border-blue-700">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-1">
                <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                {t('help.for_this_page')}
              </h2>
              <ArticleList articles={forPage} />
            </Card>
          )}
          {GROUP_ORDER.map(group => {
            const inGroup = articles.filter(article => helpGroup(article) === group)
            if (inGroup.length === 0) return null
            return (
              <Card key={group}>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t(`help.groups.${group}`)}</h2>
                <ArticleList articles={inGroup} />
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}

export default HelpPage
