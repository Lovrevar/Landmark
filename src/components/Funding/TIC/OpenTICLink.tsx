import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { canManageTIC } from '../../../utils/permissions'

interface OpenTICLinkProps {
  /** The project whose TIC should open; the TIC page selects it from `?project=`. */
  projectId: string
  className?: string
}

/**
 * The way from "budget not set" to the place a budget is set. A project's budget comes only from
 * its TIC, which is not obvious on the screens that show the budget, so wherever one of them
 * says there is none, this says where to go. Shown only to the roles that can save a TIC.
 */
export const OpenTICLink: React.FC<OpenTICLinkProps> = ({ projectId, className = '' }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!canManageTIC(user)) return null
  return (
    <Link
      to={`/tic?project=${encodeURIComponent(projectId)}`}
      className={`inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline ${className}`}
    >
      {t('general_projects.open_tic')}
      <ArrowRight className="w-4 h-4" aria-hidden="true" />
    </Link>
  )
}
