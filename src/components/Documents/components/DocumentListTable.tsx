import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Files, ExternalLink, Trash2, Loader2, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

import { Table, Badge, EmptyState, Button } from '../../ui'
import type { SearchableOption } from '../../ui/SearchableSelect'
import { formatFileSize } from '../../../utils/formatters'
import type { DocumentAssociation, DocumentCategory, DocumentWithRelations } from '../types'
import { badgeVariantForType, resolveEntityLabel } from '../utils/entityHelpers'

interface DocumentListTableProps {
  documents: DocumentWithRelations[]
  loading: boolean
  openingId: string | null
  categoryById: Map<string, DocumentCategory>
  projectOptions: SearchableOption[]
  subcontractorOptions: SearchableOption[]
  phaseOptions: SearchableOption[]
  contractOptions: SearchableOption[]
  creditOptions: SearchableOption[]
  breadcrumbFor: (cat: DocumentCategory | null) => string
  onOpen: (doc: DocumentWithRelations) => void
  onDelete: (doc: DocumentWithRelations) => void
}

export const DocumentListTable: React.FC<DocumentListTableProps> = ({
  documents, loading, openingId, categoryById,
  projectOptions, subcontractorOptions, phaseOptions,
  contractOptions, creditOptions,
  breadcrumbFor, onOpen, onDelete,
}) => {
  const { t } = useTranslation()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const lookups = {
    project: projectOptions,
    subcontractor: subcontractorOptions,
    phase: phaseOptions,
    contract: contractOptions,
    credit: creditOptions,
  }

  const renderBadge = (a: DocumentAssociation) => (
    <Badge key={a.id} variant={badgeVariantForType(a.entity_type)} size="sm">
      <span className="font-normal opacity-70 mr-1">
        {t(`documents.page.entity_label.${a.entity_type}`)}:
      </span>
      {resolveEntityLabel(a, lookups)}
    </Badge>
  )

  if (loading && documents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 py-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <EmptyState
          icon={Files}
          title={t('documents.page.empty.title')}
          description={t('documents.page.empty.description')}
        />
      </div>
    )
  }

  return (
    <div className={loading ? 'opacity-60 transition-opacity' : ''}>
      <Table>
        <Table.Head>
          <tr>
            <Table.Th>
              <span className="sr-only">{t('documents.page.table.expand')}</span>
            </Table.Th>
            <Table.Th>{t('documents.page.table.filename')}</Table.Th>
            <Table.Th>{t('documents.page.table.category')}</Table.Th>
            <Table.Th>{t('documents.page.table.project')}</Table.Th>
            <Table.Th>{t('documents.page.table.uploaded_at')}</Table.Th>
            <Table.Th sticky>{t('documents.page.table.actions')}</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {documents.map(doc => {
            const expanded = expandedIds.has(doc.id)
            const cat = doc.category_id ? categoryById.get(doc.category_id) ?? null : null
            const projects = doc.associations.filter(a => a.entity_type === 'project')
            const others   = doc.associations.filter(a => a.entity_type !== 'project')
            return (
              <React.Fragment key={doc.id}>
                <Table.Tr>
                  <Table.Td>
                    <button
                      type="button"
                      onClick={() => toggleExpand(doc.id)}
                      aria-label={expanded
                        ? t('documents.page.table.collapse')
                        : t('documents.page.table.expand')}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                  </Table.Td>
                  <Table.Td label={t('documents.page.table.filename')}>
                    <div className="flex items-center gap-2 min-w-0 max-w-[16rem] xl:max-w-sm">
                      <Files className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span
                        className="font-medium text-gray-900 dark:text-white truncate"
                        title={doc.file_name}
                      >
                        {doc.file_name}
                      </span>
                    </div>
                  </Table.Td>
                  <Table.Td label={t('documents.page.table.category')}>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {breadcrumbFor(cat) || '—'}
                    </span>
                  </Table.Td>
                  <Table.Td label={t('documents.page.table.project')}>
                    {projects.length === 0
                      ? <span className="text-xs text-gray-400">—</span>
                      : (
                        <div className="flex flex-wrap gap-1">
                          {projects.map(renderBadge)}
                        </div>
                      )}
                  </Table.Td>
                  <Table.Td label={t('documents.page.table.uploaded_at')}>
                    <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {format(new Date(doc.uploaded_at), 'dd.MM.yyyy HH:mm')}
                    </span>
                  </Table.Td>
                  <Table.Td sticky>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        icon={openingId === doc.id ? Loader2 : ExternalLink}
                        onClick={() => onOpen(doc)}
                        disabled={openingId === doc.id}
                        title={t('documents.page.actions.open')}
                        className={[
                          'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 bg-transparent',
                          openingId === doc.id ? '[&>svg]:animate-spin' : '',
                        ].join(' ')}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        icon={Trash2}
                        onClick={() => onDelete(doc)}
                        title={t('documents.page.actions.delete')}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 bg-transparent"
                      />
                    </div>
                  </Table.Td>
                </Table.Tr>
                {expanded && (
                  <tr className="bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
                    <td colSpan={6} className="px-6 py-4">
                      {/* w-0 + min-w-full keeps this cell from widening the min-w-max
                          table, so the description wraps at the visible table width */}
                      <div className="w-0 min-w-full space-y-4">
                        <DetailRow label={t('documents.page.table.filename')}>
                          <span className="text-sm font-medium text-gray-900 dark:text-white break-all">
                            {doc.file_name}
                          </span>
                        </DetailRow>
                        <DetailRow label={t('documents.page.table.description')}>
                          {doc.description
                            ? <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{doc.description}</span>
                            : <span className="text-sm italic text-gray-400">{t('documents.page.table.no_description')}</span>}
                        </DetailRow>
                        {others.length > 0 && (
                          <DetailRow label={t('documents.page.table.other_associations')}>
                            <div className="flex flex-wrap gap-1">{others.map(renderBadge)}</div>
                          </DetailRow>
                        )}
                        <DetailRow label={t('documents.page.table.size')}>
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {formatFileSize(doc.file_size)}
                          </span>
                        </DetailRow>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </Table.Body>
      </Table>
    </div>
  )
}

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
      {label}
    </div>
    {children}
  </div>
)
