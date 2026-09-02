import React from 'react'
import { Badge } from '../ui'
import { PROJECT_CATEGORY_LABELS, type ProjectCategory } from '../../lib/supabase'

// Category values are Croatian domain terms and stay untranslated, so the badge
// renders PROJECT_CATEGORY_LABELS directly rather than going through i18n.
const CATEGORY_VARIANTS: Record<ProjectCategory, 'purple' | 'teal' | 'gray'> = {
  stambeno: 'purple',
  retail: 'teal',
  interno: 'gray'
}

interface Props {
  /** Rows written before the column existed can come back without a category. */
  category: ProjectCategory | null | undefined
  size?: 'sm' | 'md'
  className?: string
}

const ProjectCategoryBadge: React.FC<Props> = ({ category, size = 'sm', className }) => {
  if (!category || !(category in PROJECT_CATEGORY_LABELS)) return null

  return (
    <Badge variant={CATEGORY_VARIANTS[category]} size={size} className={className}>
      {PROJECT_CATEGORY_LABELS[category]}
    </Badge>
  )
}

export default ProjectCategoryBadge
