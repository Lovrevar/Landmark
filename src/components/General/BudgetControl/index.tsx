import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Activity,
} from 'lucide-react'
import { PROJECT_CATEGORY_LABELS } from '../../../lib/supabase'
import { useBudgetControl } from './hooks/useBudgetControl'
import LoadingSpinner from '../../ui/LoadingSpinner'
import ErrorState from '../../ui/ErrorState'
import { formatEuro, formatEuroCompact, NO_VALUE } from '../../../utils/formatters'

/**
 * Abbreviated euros for the EVM tiles and the chart's Y axis. Named for what it does, so it no
 * longer shadows the shared `formatEuro` — which is the exact-cents renderer, not this one.
 */
const compactEuro = formatEuroCompact

/** The same figure in full, under a tile and in the chart tooltip. */
const formatEuroFull = formatEuro

interface IndexCardProps {
  label: string
  /** `null` when the index cannot be computed — rendered as "—" rather than a made-up 1.00. */
  value: number | null
  sublabel: string
  status: 'good' | 'warning' | 'bad' | 'unknown'
}

function IndexCard({ label, value, sublabel, status }: IndexCardProps) {
  const colors = {
    good: { bg: 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700', text: 'text-green-700 dark:text-green-400', sub: 'text-green-600 dark:text-green-400', label: 'text-green-800 dark:text-green-300' },
    warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-400', sub: 'text-yellow-600 dark:text-yellow-400', label: 'text-yellow-800 dark:text-yellow-300' },
    bad: { bg: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800', text: 'text-red-700 dark:text-red-400', sub: 'text-red-600 dark:text-red-400', label: 'text-red-800 dark:text-red-300' },
    unknown: { bg: 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700', text: 'text-gray-500 dark:text-gray-400', sub: 'text-gray-500 dark:text-gray-400', label: 'text-gray-500 dark:text-gray-400' },
  }
  const c = colors[status]
  const Icon = status === 'good' ? CheckCircle : status === 'unknown' ? HelpCircle : AlertCircle

  return (
    <div className={`rounded-xl border p-4 ${c.bg}`}>
      <p className={`text-sm font-medium mb-1 ${c.label}`}>{label}</p>
      <p className={`text-2xl font-bold ${c.text}`}>{value === null ? NO_VALUE : value.toFixed(2)}</p>
      <div className={`flex items-center gap-1 mt-1 text-xs ${c.sub}`}>
        <Icon className="w-3 h-3" />
        <span>{sublabel}</span>
      </div>
    </div>
  )
}

function getIndexStatus(value: number, type: 'CPI' | 'SPI'): { status: 'good' | 'warning' | 'bad'; labelKey: string } {
  if (value >= 1.0) return { status: 'good', labelKey: type === 'CPI' ? 'budget_control.cpi_good' : 'budget_control.spi_good' }
  if (value >= 0.9) return { status: 'warning', labelKey: type === 'CPI' ? 'budget_control.cpi_warning' : 'budget_control.spi_warning' }
  return { status: 'bad', labelKey: type === 'CPI' ? 'budget_control.cpi_bad' : 'budget_control.spi_bad' }
}

const CHART_COLORS = {
  planned: '#4f86c6',
  committed: '#f59e0b',
  paid: '#22c55e',
  /**
   * The forecast bar follows the sign of VAC, exactly as the EAC and VAC tiles already do.
   * It was hardcoded red, so a project forecast to come in **under** budget got a red bar
   * beside two green tiles saying the opposite.
   */
  forecastUnder: '#16a34a',
  forecastOver: '#ef4444',
  cpi: '#4f86c6',
  spi: '#22c55e',
}

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
}

export default function BudgetControl() {
  const { t } = useTranslation()
  const { projects, selectedProjectId, setSelectedProjectId, data, loading, error, refetch } = useBudgetControl()

  const barData = data
    ? [
        {
          name: t('budget_control.chart_label'),
          [t('budget_control.planned')]: data.plannedBudget,
          [t('budget_control.committed')]: data.committed,
          [t('budget_control.paid')]: data.paid,
          [t('budget_control.forecast_eac')]: data.metrics.EAC,
        },
      ]
    : []

  const scatterCPI = data ? [{ x: t('budget_control.current'), y: data.metrics.CPI }] : []
  // No schedule baseline means no SPI point to plot — a fabricated 1.00 on the target line is
  // the most reassuring thing this chart could draw.
  const scatterSPI = data && data.metrics.scheduleAvailable !== false
    ? [{ x: t('budget_control.current'), y: data.metrics.SPI }]
    : []

  const hasBudgetData = !!data && data.plannedBudget > 0
  const cpiStatus = hasBudgetData ? getIndexStatus(data.metrics.CPI, 'CPI') : null

  /**
   * SPI is only a figure when at least one phase carries both a start and an end date.
   * Without one `calculateProjectEVM` falls back to 1 (`evm.ts:135`) and nothing read
   * `scheduleAvailable`, so a project with no dates at all reported a confident
   * "On schedule ✓".
   */
  const scheduleAvailable = hasBudgetData && data.metrics.scheduleAvailable !== false
  const spiStatus = scheduleAvailable ? getIndexStatus(data.metrics.SPI, 'SPI') : null

  /**
   * EAC is `plannedBudget / CPI`, and CPI is 0 when money has been spent with no earned value
   * against it. `evm.ts:138` then falls back to EAC = the budget, so VAC = 0 — and the tiles
   * read a cheerful green "Ispod proračuna" next to a red CPI of 0.00. There is no forecast to
   * give in that state, so both tiles say so.
   */
  const forecastAvailable = hasBudgetData && data.metrics.CPI !== 0
  const forecastUnderBudget = forecastAvailable && data.metrics.VAC >= 0

  return (
    <div className="p-6 space-y-6">
      {/* Header + Project Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('budget_control.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('budget_control.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('budget_control.project')}:</label>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:min-w-[220px]"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.category ? `${p.name} — ${PROJECT_CATEGORY_LABELS[p.category]}` : p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* No figures loaded and the load failed: the screen says so and offers a retry, instead of
          leaving the reader with an empty page that looks like a project with no cost plan. */}
      {error && !loading && !data && (
        <ErrorState onRetry={refetch} description={error} />
      )}

      {error && data && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}

      {!loading && data && !hasBudgetData && (
        <div className="text-center py-16">
          <p className="text-base font-medium text-gray-700 dark:text-gray-200">{t('budget_control.no_budget_data')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('budget_control.no_budget_data_sub')}</p>
        </div>
      )}

      {!loading && hasBudgetData && (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            <MetricCard
              label={t('budget_control.tic')}
              sublabel={t('budget_control.tic_sub')}
              value={formatEuroFull(data.tic)}
              icon={DollarSign}
              variant="default"
            />
            <MetricCard
              label={t('budget_control.planned_budget')}
              sublabel={t('budget_control.planned_budget_sub')}
              value={formatEuroFull(data.plannedBudget)}
              icon={DollarSign}
              variant="default"
            />
            <MetricCard
              label={t('budget_control.committed')}
              sublabel={data.plannedBudget > 0
                ? `${((data.committed / data.plannedBudget) * 100).toFixed(0)}% ${t('budget_control.of_budget')}`
                : '—'}
              value={formatEuroFull(data.committed)}
              icon={Activity}
              /* Amber, matching this figure's own bar in the chart below. The green ring said
                 "good" about a number that is neither good nor bad. */
              variant="amber"
            />
            <MetricCard
              label={t('budget_control.paid')}
              sublabel={data.committed > 0
                ? `${((data.paid / data.committed) * 100).toFixed(0)}% ${t('budget_control.of_committed')}`
                : '—'}
              value={formatEuroFull(data.paid)}
              icon={DollarSign}
              variant="default"
            />
            <MetricCard
              label={t('budget_control.forecast_eac')}
              sublabel={!forecastAvailable
                ? t('budget_control.no_forecast')
                : forecastUnderBudget ? t('budget_control.under_budget') : t('budget_control.over_budget')}
              value={forecastAvailable ? formatEuroFull(data.metrics.EAC) : NO_VALUE}
              icon={!forecastAvailable ? HelpCircle : forecastUnderBudget ? TrendingDown : TrendingUp}
              variant={!forecastAvailable ? 'default' : forecastUnderBudget ? 'good' : 'bad'}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Budget Control Bar Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('budget_control.budget_chart_title')}</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tickFormatter={compactEuro} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => formatEuroFull(Number(value))}
                    contentStyle={tooltipStyle}
                  />
                  <Legend />
                  <Bar dataKey={t('budget_control.planned')} fill={CHART_COLORS.planned} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={t('budget_control.committed')} fill={CHART_COLORS.committed} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={t('budget_control.paid')} fill={CHART_COLORS.paid} radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey={t('budget_control.forecast_eac')}
                    fill={forecastUnderBudget ? CHART_COLORS.forecastUnder : CHART_COLORS.forecastOver}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* EVM Performance Indices Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('budget_control.evm_indices_title')}</h2>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="x"
                    type="category"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    allowDuplicatedCategory={false}
                  />
                  <YAxis domain={[0, 2]} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => Number(value).toFixed(2)}
                    contentStyle={tooltipStyle}
                  />
                  <Legend />
                  <ReferenceLine y={1.0} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: t('budget_control.target_line'), fill: '#f59e0b', fontSize: 11, position: 'insideTopLeft' }} />
                  <ReferenceLine y={0.9} stroke="#ef4444" strokeDasharray="4 4" label={{ value: t('budget_control.warning_line'), fill: '#ef4444', fontSize: 11, position: 'insideBottomRight' }} />
                  <Scatter
                    name={t('budget_control.cpi')}
                    data={scatterCPI}
                    dataKey="y"
                    fill={CHART_COLORS.cpi}
                    line={{ stroke: CHART_COLORS.cpi }}
                  />
                  <Scatter
                    name={t('budget_control.spi')}
                    data={scatterSPI}
                    dataKey="y"
                    fill={CHART_COLORS.spi}
                    line={{ stroke: CHART_COLORS.spi }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('budget_control.evm_indices_caption')}</p>
            </div>
          </div>

          {/* EVM Performance Metrics Row */}
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('budget_control.evm_metrics_title')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
              {cpiStatus && (
                <IndexCard
                  label={t('budget_control.cpi')}
                  value={data.metrics.CPI}
                  sublabel={t(cpiStatus.labelKey)}
                  status={cpiStatus.status}
                />
              )}
              <IndexCard
                label={t('budget_control.spi')}
                value={spiStatus ? data.metrics.SPI : null}
                sublabel={spiStatus ? t(spiStatus.labelKey) : t('budget_control.no_schedule')}
                status={spiStatus ? spiStatus.status : 'unknown'}
              />
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4">
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">{t('budget_control.eac')}</p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {forecastAvailable ? compactEuro(data.metrics.EAC) : NO_VALUE}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {forecastAvailable ? formatEuroFull(data.metrics.EAC) : t('budget_control.no_forecast')}
                </p>
              </div>
              {forecastAvailable ? (
                <div className={`rounded-xl border p-4 ${forecastUnderBudget ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                  <p className={`text-sm mb-1 ${forecastUnderBudget ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{t('budget_control.vac')}</p>
                  <p className={`text-xl font-bold ${forecastUnderBudget ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>{compactEuro(data.metrics.VAC)}</p>
                  <div className={`flex items-center gap-1 mt-1 text-xs ${forecastUnderBudget ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {forecastUnderBudget
                      ? <><CheckCircle className="w-3 h-3" /><span>{t('budget_control.under_budget')} ✓</span></>
                      : <><AlertCircle className="w-3 h-3" /><span>{t('budget_control.over_budget')} ✗</span></>
                    }
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4">
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">{t('budget_control.vac')}</p>
                  <p className="text-xl font-bold text-gray-500 dark:text-gray-400">{NO_VALUE}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <HelpCircle className="w-3 h-3" /><span>{t('budget_control.no_forecast')}</span>
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4">
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">{t('budget_control.completion')}</p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{data.completionPct.toFixed(0)}%</p>
                <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, data.completionPct)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !data && !error && projects.length === 0 && (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          {t('budget_control.no_projects')}
        </div>
      )}
    </div>
  )
}

// ── Internal metric card ───────────────────────────────────────────────────

type MetricVariant = 'default' | 'active' | 'amber' | 'good' | 'bad'

interface MetricCardProps {
  label: string
  sublabel: string
  value: string
  icon: React.ElementType
  variant: MetricVariant
}

function MetricCard({ label, sublabel, value, icon: Icon, variant }: MetricCardProps) {
  const styles: Record<MetricVariant, { container: string; label: string; value: string; icon: string }> = {
    default: {
      container: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
      label: 'text-gray-500 dark:text-gray-400',
      value: 'text-gray-900 dark:text-white',
      icon: 'text-gray-400 dark:text-gray-500',
    },
    active: {
      container: 'bg-white dark:bg-gray-800 border-green-400 ring-1 ring-green-400',
      label: 'text-gray-500 dark:text-gray-400',
      value: 'text-green-600 dark:text-green-400',
      icon: 'text-green-400',
    },
    // Matches CHART_COLORS.committed, so the tile and its bar are the same quantity in the
    // same colour.
    amber: {
      container: 'bg-white dark:bg-gray-800 border-amber-400 ring-1 ring-amber-400',
      label: 'text-gray-500 dark:text-gray-400',
      value: 'text-amber-600 dark:text-amber-400',
      icon: 'text-amber-500',
    },
    good: {
      container: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
      label: 'text-green-700 dark:text-green-400',
      value: 'text-green-800 dark:text-green-300',
      icon: 'text-green-500',
    },
    bad: {
      container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      label: 'text-red-700 dark:text-red-400',
      value: 'text-red-800 dark:text-red-300',
      icon: 'text-red-500',
    },
  }
  const s = styles[variant]

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${s.container}`}>
      <div className="flex items-start justify-between mb-2">
        <p className={`text-sm font-medium ${s.label}`}>{label}</p>
        <Icon className={`w-4 h-4 ${s.icon} flex-shrink-0`} />
      </div>
      <p className={`text-lg font-bold ${s.value} leading-tight`}>{value}</p>
      <p className={`text-xs mt-1 ${s.label} opacity-80`}>{sublabel}</p>
    </div>
  )
}
