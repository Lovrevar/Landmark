import React from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Badge, Button } from '../../../ui'
import { daysFromToday, isValidDate, parseLocalDate } from '../../../../utils/dateOnly'
import { formatEuro, NO_VALUE } from '../../../../utils/formatters'
import { getCreditStatusDisplay } from '../utils/creditStatus'
import { getCreditTypeLabelKey, getCreditTypeBadgeVariant } from '../utils/creditCalculations'
import type { BankCredit } from '../../../../lib/supabase'

/** A credit is "maturing soon" for the last 90 days before maturity — and only while it is live. */
const MATURING_SOON_DAYS = 90

interface CreditFacilityCardProps {
  credit: BankCredit
  onEdit: (credit: BankCredit) => void
  onDelete: (id: string) => void
}

const CreditFacilityCard: React.FC<CreditFacilityCardProps> = ({ credit, onEdit, onDelete }) => {
  const { t } = useTranslation()

  // `differenceInDays(maturity, now) <= 90` was also true for every credit that matured years ago,
  // and said nothing about whether the credit was still live: a repaid one wore "USKORO DOSPIJEVA"
  // for the rest of its life. Split the two cases, and only for an active credit.
  const daysToMaturity = daysFromToday(credit.maturity_date)
  const isActive = credit.status === 'active'
  const knownMaturity = Number.isFinite(daysToMaturity)
  const isPastMaturity = isActive && knownMaturity && daysToMaturity < 0
  const isMaturing = isActive && knownMaturity && daysToMaturity >= 0 && daysToMaturity <= MATURING_SOON_DAYS

  const paymentRatio = credit.amount > 0 ? ((credit.repaid_amount || 0) / credit.amount) * 100 : 0

  const status = getCreditStatusDisplay(credit.status)
  const typeKey = getCreditTypeLabelKey(credit.credit_type, credit.credit_seniority)

  const maturityClass = isPastMaturity
    ? 'text-red-600 dark:text-red-400'
    : isMaturing
      ? 'text-orange-600 dark:text-orange-400'
      : 'text-gray-900 dark:text-white'

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2 flex-wrap gap-y-1">
            {/* One badge for the type. It used to be a hardcoded "EQUITY", a local copy of the
                variant map, and `credit_type.replace('_', ' ')` — which printed "LINE OF_CREDIT",
                String.replace having replaced only the first underscore. The seniority badge that
                used to sit beside it is gone: the type label already carries it (the credit form
                only offers junior for a line of credit). */}
            <Badge variant={credit.credit_type === 'equity' ? 'purple' : getCreditTypeBadgeVariant(credit.credit_type)} size="sm">
              {typeKey ? t(typeKey) : credit.credit_type.replace(/_/g, ' ')}
            </Badge>
            <Badge variant={status?.variant ?? 'gray'} size="sm">
              {status ? t(status.labelKey) : credit.status}
            </Badge>
            {isPastMaturity && (
              <Badge variant="red" size="sm">{t('funding.investors.credit_facility_card.past_maturity')}</Badge>
            )}
            {isMaturing && (
              <Badge variant="orange" size="sm">{t('funding.investors.credit_facility_card.maturing_soon')}</Badge>
            )}
          </div>
          {credit.credit_name && (
            <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">{credit.credit_name}</p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{credit.purpose}</p>
          {credit.accounting_companies && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('funding.investors.credit_facility_card.company_label')} {credit.accounting_companies.name}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatEuro(credit.amount)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{credit.interest_rate}% APR</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.investors.credit_facility_card.used_amount_label')}</p>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{formatEuro(credit.used_amount || 0)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {credit.amount > 0 ? ((credit.used_amount || 0) / credit.amount * 100).toFixed(1) : 0}% {t('funding.investors.credit_facility_card.drawn_label')}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.investors.credit_facility_card.repaid_to_bank_label')}</p>
          <p className="text-sm font-medium text-green-600 dark:text-green-400">{formatEuro(credit.repaid_amount || 0)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.investors.credit_facility_card.outstanding_debt_label')}</p>
          <p className={`text-sm font-medium ${(credit.outstanding_balance || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
            {formatEuro(credit.outstanding_balance || 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.investors.credit_facility_card.available_to_use_label')}</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatEuro(credit.amount - (credit.used_amount || 0))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{credit.repayment_type === 'yearly' ? t('funding.investors.credit_facility_card.annual_payment_label') : t('funding.investors.credit_facility_card.monthly_payment_label')}</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{formatEuro(credit.monthly_payment || 0)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.investors.credit_facility_card.maturity_date_label')}</p>
          <p className={`text-sm font-medium ${maturityClass}`}>
            {isValidDate(credit.maturity_date)
              ? format(parseLocalDate(credit.maturity_date), 'dd.MM.yyyy')
              : NO_VALUE}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-600 dark:text-gray-400">{t('funding.investors.credit_facility_card.repayment_progress_label')}</span>
          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{paymentRatio.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
          <div
            className="bg-green-600 dark:bg-green-500 h-2 rounded-full"
            style={{ width: `${Math.min(100, paymentRatio)}%` }}
          ></div>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
        <Button icon={Edit2} onClick={() => onEdit(credit)} size="sm">{t('common.edit')}</Button>
        <Button icon={Trash2} variant="danger" onClick={() => onDelete(credit.id)} size="sm" />
      </div>
    </div>
  )
}

export default CreditFacilityCard
