import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  HelpCircle,
  Loader,
  Package,
  type LucideIcon
} from 'lucide-react'
import type { WorkLogStatus } from './services/workLogService'

/**
 * How a work-log status looks: label, icon, badge colour and the card's left stripe.
 *
 * The stripe used to be a separate `work_logs.color` the author picked by hand, so a finished log
 * could carry a red stripe, and the picker's swatches did not even match what the list drew. It is
 * now the status and nothing else. Badge and stripe sit in the same entry, in the same hue, so the
 * two cannot drift apart. The column is still in the database but nothing reads or writes it.
 *
 * Stripe classes are literal strings on purpose: Tailwind only emits classes it finds written out
 * in the source, so a class assembled at runtime would render no colour at all. Each carries a
 * `dark:` twin because the cards also set `dark:border-gray-700`, which outranks a bare
 * `border-l-*` in dark mode and would otherwise paint every stripe grey.
 */
export interface WorkLogStatusConfig {
  tKey: string
  icon: LucideIcon
  variant: 'green' | 'blue' | 'red' | 'orange' | 'yellow' | 'gray'
  stripe: string
}

export const statusConfig: Record<WorkLogStatus, WorkLogStatusConfig> = {
  work_finished: {
    tKey: 'supervision.work_logs.status.work_finished',
    icon: CheckCircle2,
    variant: 'green',
    stripe: 'border-l-green-500 dark:border-l-green-500'
  },
  in_progress: {
    tKey: 'supervision.work_logs.status.in_progress',
    icon: Loader,
    variant: 'blue',
    stripe: 'border-l-blue-500 dark:border-l-blue-500'
  },
  blocker: {
    tKey: 'supervision.work_logs.status.blocker',
    icon: AlertTriangle,
    variant: 'red',
    stripe: 'border-l-red-500 dark:border-l-red-500'
  },
  quality_issue: {
    tKey: 'supervision.work_logs.status.quality_issue',
    icon: AlertCircle,
    variant: 'orange',
    stripe: 'border-l-orange-500 dark:border-l-orange-500'
  },
  waiting_materials: {
    tKey: 'supervision.work_logs.status.waiting_materials',
    icon: Package,
    variant: 'yellow',
    stripe: 'border-l-yellow-500 dark:border-l-yellow-500'
  },
  weather_delay: {
    tKey: 'supervision.work_logs.status.weather_delay',
    icon: CloudRain,
    variant: 'gray',
    stripe: 'border-l-gray-400 dark:border-l-gray-400'
  }
}

// `work_logs.status` is a nullable column with no default, so a row can legitimately carry no
// status — anything written before the column existed, or outside this form. Without a fallback
// the lookup returns undefined and the whole page unmounts on one such row.
export const unknownStatusConfig: WorkLogStatusConfig = {
  tKey: 'supervision.work_logs.status.unknown',
  icon: HelpCircle,
  variant: 'gray',
  stripe: 'border-l-gray-400 dark:border-l-gray-400'
}

/**
 * Config for any status value, known or not. Takes a plain string because the dashboard reads
 * the column untyped. An own-property check, so a value such as "constructor" cannot resolve to
 * something on Object.prototype.
 */
export function statusConfigFor(status: string | null | undefined): WorkLogStatusConfig {
  if (status && Object.prototype.hasOwnProperty.call(statusConfig, status)) {
    return statusConfig[status as WorkLogStatus]
  }
  return unknownStatusConfig
}

/** The card's left-border colour for a status. */
export const stripeClass = (status: string | null | undefined): string => statusConfigFor(status).stripe
