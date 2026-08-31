import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Upload } from 'lucide-react'
import {
  Alert, Badge, Button, Card, EmptyState, LoadingSpinner,
  PageHeader, Select, Table,
} from '../../ui'
import { formatEuropean } from '../../../utils/formatters'
import { useErpImport } from './hooks/useErpImport'
import { FEED_NAMES, REFERENCE_FEEDS, type FeedName, type RunStatus } from './types'
import { formatEuropean as fmt } from '../../../utils/formatters'

/**
 * Cashflow ▸ ERP import. Uploads a 4D Wand feed export to the `import-erp`
 * edge function, which parses, validates and stages it — nothing here reaches
 * `accounting_invoices` until phase 3's promotion step.
 *
 * The same screen doubles as the run log for agent-pushed files, so there is
 * one place to see what has landed regardless of how it arrived.
 */
export default function ErpImport() {
  const { t } = useTranslation()
  const s = useErpImport()
  const fileInput = useRef<HTMLInputElement>(null)

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void s.upload(file)
    e.target.value = ''   // let the same file be re-uploaded after a fix
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('erp_import.title')}
        description={t('erp_import.description')}
        actions={
          <Button variant="secondary" onClick={() => void s.reload()}>
            {t('common.refresh')}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('erp_import.feed_label')}
            </label>
            <Select value={s.feed} onChange={e => s.setFeed(e.target.value as FeedName)}>
              {FEED_NAMES.map(f => (
                <option key={f} value={f}>{t(`erp_import.feed.${f}`)}</option>
              ))}
            </Select>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            className="hidden"
            onChange={onFile}
          />
          <Button
            icon={Upload}
            loading={s.uploading}
            onClick={() => fileInput.current?.click()}
          >
            {t('erp_import.choose_file')}
          </Button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {REFERENCE_FEEDS.includes(s.feed)
            ? t('erp_import.hint_reference')
            : t('erp_import.hint_document')}
        </p>

        {s.error && <Alert variant="error" className="mt-3">{s.error}</Alert>}

        {s.lastResult && <UploadSummary result={s.lastResult} />}
      </Card>

      {s.review.length > 0 && <ReviewQueue s={s} />}

      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
          {t('erp_import.history')}
        </h2>
        {s.loading ? (
          <LoadingSpinner />
        ) : s.runs.length === 0 ? (
          <EmptyState
            icon={Upload}
            title={t('erp_import.no_runs')}
            description={t('erp_import.no_runs_hint')}
          />
        ) : (
          <Table>
            <Table.Head>
              <Table.Tr>
                <Table.Th>{t('erp_import.col_started')}</Table.Th>
                <Table.Th>{t('erp_import.col_feed')}</Table.Th>
                <Table.Th>{t('erp_import.col_file')}</Table.Th>
                <Table.Th>{t('erp_import.col_transport')}</Table.Th>
                <Table.Th>{t('erp_import.col_status')}</Table.Th>
                <Table.Th>{t('erp_import.col_rows')}</Table.Th>
                <Table.Th><span className="sr-only">{t('common.actions')}</span></Table.Th>
              </Table.Tr>
            </Table.Head>
            <Table.Body>
              {s.runs.map(run => (
                <React.Fragment key={run.id}>
                  <Table.Tr>
                    <Table.Td label={t('erp_import.col_started')}>
                      {new Date(run.started_at).toLocaleString('hr-HR')}
                    </Table.Td>
                    <Table.Td label={t('erp_import.col_feed')}>
                      {t(`erp_import.feed.${run.feed}`, { defaultValue: run.feed })}
                    </Table.Td>
                    <Table.Td label={t('erp_import.col_file')}>
                      <span className="font-mono text-xs">{run.file_name}</span>
                    </Table.Td>
                    <Table.Td label={t('erp_import.col_transport')}>
                      {t(`erp_import.transport.${run.transport}`)}
                    </Table.Td>
                    <Table.Td label={t('erp_import.col_status')}>
                      <StatusBadge status={run.status} />
                    </Table.Td>
                    <Table.Td label={t('erp_import.col_rows')}>
                      {formatEuropean(run.rows_staged)}
                      {run.rows_rejected > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          {' / '}{formatEuropean(run.rows_rejected)} {t('erp_import.rejected')}
                        </span>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {run.rows_rejected > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => void s.toggleProblems(run.id)}>
                          {s.expandedRunId === run.id ? t('common.hide') : t('erp_import.show_problems')}
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>

                  {s.expandedRunId === run.id && (
                    <Table.Tr hoverable={false}>
                      <Table.Td colSpan={7}>
                        {s.problemsLoading ? (
                          <LoadingSpinner />
                        ) : (
                          <ul className="space-y-1 py-2">
                            {s.problems.map(p => (
                              <li key={`${p.feed}-${p.row_number}`} className="text-sm">
                                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                  {t('erp_import.row')} {p.row_number}
                                </span>
                                {' — '}
                                <span className="font-mono text-xs">{p.document_ref}</span>
                                <ul className="ml-6 list-disc text-red-600 dark:text-red-400">
                                  {p.validation_errors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  )}
                </React.Fragment>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>
    </div>
  )
}

/**
 * Documents that imported cleanly but could not be classified — an unmapped
 * account, cost centre or partner. Promotion is all-or-nothing per document,
 * so one unmapped code holds the whole invoice rather than promoting part of
 * it; the fix is to map the code in Šifrarnici and re-run classification here.
 */
function ReviewQueue({ s }: { s: ReturnType<typeof useErpImport> }) {
  const { t } = useTranslation()
  const runIds = [...new Set(s.review.map(r => r.import_run_id))]

  return (
    <Card variant="bordered" className="border-yellow-300 dark:border-yellow-700">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            {t('erp_import.review_title', { count: s.review.length })}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('erp_import.review_hint')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {runIds.map(id => (
            <Button
              key={id}
              variant="secondary"
              size="sm"
              loading={s.reclassifying === id}
              onClick={() => void s.reclassify(id)}
            >
              {t('erp_import.reclassify')}
            </Button>
          ))}
        </div>
      </div>

      <Table>
        <Table.Head>
          <Table.Tr>
            <Table.Th>{t('erp_import.col_document')}</Table.Th>
            <Table.Th>{t('erp_import.col_partner')}</Table.Th>
            <Table.Th>{t('erp_import.col_amount')}</Table.Th>
            <Table.Th>{t('erp_import.col_problems')}</Table.Th>
          </Table.Tr>
        </Table.Head>
        <Table.Body>
          {s.review.map(r => (
            <Table.Tr key={`${r.import_run_id}-${r.document_ref}`}>
              <Table.Td label={t('erp_import.col_document')}>
                <span className="font-mono text-xs">{r.invoice_number ?? r.document_ref}</span>
                <span className="block text-xs text-gray-400">
                  {t('erp_import.lines', { count: r.line_count })}
                </span>
              </Table.Td>
              <Table.Td label={t('erp_import.col_partner')}>{r.partner_name ?? '—'}</Table.Td>
              <Table.Td label={t('erp_import.col_amount')}>
                {r.total_amount === null ? '—' : fmt(r.total_amount)}
              </Table.Td>
              <Table.Td label={t('erp_import.col_problems')}>
                <ul className="list-disc ml-4 text-sm text-yellow-800 dark:text-yellow-300">
                  {r.problems.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Body>
      </Table>
    </Card>
  )
}

function UploadSummary({ result }: { result: { rows_total?: number; rows_staged?: number; rows_rejected?: number; problems?: { row: number; errors: string[] }[] } }) {
  const { t } = useTranslation()
  const rejected = result.rows_rejected ?? 0
  const clean = rejected === 0

  return (
    <Alert variant={clean ? 'success' : 'warning'} className="mt-3">
      <div className="min-w-0">
        <p>
          {t('erp_import.result_summary', {
            total: result.rows_total ?? 0,
            staged: result.rows_staged ?? 0,
            rejected,
          })}
        </p>
        {!clean && result.problems && result.problems.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-sm">
            {result.problems.slice(0, 10).map(p => (
              <li key={p.row}>
                <span className="font-mono text-xs">{t('erp_import.row')} {p.row}</span>: {p.errors.join('; ')}
              </li>
            ))}
            {result.problems.length > 10 && (
              <li className="text-gray-500 dark:text-gray-400">
                {t('erp_import.and_more', { count: result.problems.length - 10 })}
              </li>
            )}
          </ul>
        )}
      </div>
    </Alert>
  )
}

function StatusBadge({ status }: { status: RunStatus }) {
  const { t } = useTranslation()
  const variant =
    status === 'completed' ? 'success'
    : status === 'failed' ? 'red'
    : status === 'staged' ? 'blue'
    : 'gray'
  return <Badge variant={variant}>{t(`erp_import.status.${status}`, { defaultValue: status })}</Badge>
}
