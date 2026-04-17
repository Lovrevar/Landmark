import React from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { RotateCcw, ScrollText } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { canViewActivityLog } from '../../../utils/permissions'
import { useActivityLog } from './hooks/useActivityLog'
import { ACTION_CATEGORIES } from './types'
import type { ActionCategory, SeverityFilter } from './types'
import ActivityLogTable from './ActivityLogTable'
import ActivityLogDetailModal from './ActivityLogDetailModal'
import PageHeader from '../../ui/PageHeader'
import SearchInput from '../../ui/SearchInput'
import Select from '../../ui/Select'
import Pagination from '../../ui/Pagination'
import LoadingSpinner from '../../ui/LoadingSpinner'
import EmptyState from '../../ui/EmptyState'
import Button from '../../ui/Button'

const ActivityLog: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()

  const {
    logs,
    loading,
    totalCount,
    currentPage,
    pageSize,
    searchTerm,
    filterUserId,
    filterCategory,
    filterSeverity,
    filterProjectId,
    dateFrom,
    dateTo,
    users,
    projects,
    selectedLog,
    setSearchTerm,
    setFilterUserId,
    setFilterCategory,
    setFilterSeverity,
    setFilterProjectId,
    setDateFrom,
    setDateTo,
    setCurrentPage,
    setSelectedLog,
    resetFilters,
    refetch,
  } = useActivityLog()

  if (!canViewActivityLog(user)) {
    return <Navigate to="/" replace />
  }

  if (loading && logs.length === 0) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('activity_log.title')}
        description={t('activity_log.description')}
        actions={
          <Button variant="secondary" icon={RotateCcw} onClick={refetch}>
            {t('common.refresh')}
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('activity_log.search_placeholder')}
            onClear={() => setSearchTerm('')}
          />
          <Select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            compact
          >
            <option value="ALL">{t('activity_log.filter_all_users')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </Select>
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as ActionCategory)}
            compact
          >
            {ACTION_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL'
                  ? t('activity_log.filter_all_categories')
                  : t(`activity_log.categories.${cat}`, cat)}
              </option>
            ))}
          </Select>
          <Select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as SeverityFilter)}
            compact
          >
            <option value="ALL">{t('activity_log.filter_all_severity')}</option>
            <option value="low">{t('activity_log.severity.low')}</option>
            <option value="medium">{t('activity_log.severity.medium')}</option>
            <option value="high">{t('activity_log.severity.high')}</option>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <Select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            compact
          >
            <option value="ALL">{t('activity_log.filter_all_projects')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              {t('activity_log.date_from')}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              {t('activity_log.date_to')}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t('activity_log.reset_filters')}
          </Button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <LoadingSpinner message={t('common.loading')} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t('activity_log.empty_title')}
          description={t('activity_log.empty_description')}
        />
      ) : (
        <>
          <ActivityLogTable logs={logs} onViewDetail={setSelectedLog} />
          <Pagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Detail modal */}
      {selectedLog && (
        <ActivityLogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  )
}

export default ActivityLog
