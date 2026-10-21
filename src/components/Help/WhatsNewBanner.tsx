import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert } from '../ui'
import { useAuth } from '../../contexts/AuthContext'
import { useLeaveGuard } from '../../contexts/UnsavedChangesContext'
import { helpArticlePath, unseenNews } from '../../lib/helpKb'
import { markNewsSeen, readSeenNews } from '../../lib/helpNews'
import { useHelpArticles } from './hooks/useHelpArticles'

/**
 * One line above the page while there is a release note the user has not seen. It goes away for
 * good once they open the note or dismiss the line. Shows nothing while the articles load or if
 * they fail to: an announcement is an extra, never a reason for an error on someone's page.
 */
const WhatsNewBanner: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Like the rest of the shell's navigation, so a screen with unsaved edits gets to ask first.
  const requestLeave = useLeaveGuard()
  const { articles } = useHelpArticles()
  const userId = user?.id ?? null
  const [seenThrough, setSeenThrough] = useState<string | null>(() => (userId ? readSeenNews(userId) : null))

  useEffect(() => {
    setSeenThrough(userId ? readSeenNews(userId) : null)
  }, [userId])

  const note = userId ? unseenNews(articles, seenThrough) : null
  const reading = note !== null && pathname === helpArticlePath(note.id)

  const markSeen = (date: string) => {
    if (!userId) return
    markNewsSeen(userId, date)
    setSeenThrough(date)
  }

  // Opening the note is reading it, however the user got there.
  useEffect(() => {
    if (reading && note) markSeen(note.date)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markSeen only closes over userId, already tracked through `note`
  }, [reading, note?.date])

  if (!note || reading) return null

  return (
    <Alert variant="info" className="mb-4" onDismiss={() => markSeen(note.date)}>
      <span className="font-semibold">{t('help.whats_new.lead')}</span>{' '}
      {note.title}.{' '}
      <Link
        to={helpArticlePath(note.id)}
        onClick={(event) => {
          event.preventDefault()
          requestLeave(() => navigate(helpArticlePath(note.id)))
        }}
        className="underline font-medium"
      >
        {t('help.whats_new.read')}
      </Link>
    </Alert>
  )
}

export default WhatsNewBanner
