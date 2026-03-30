import React from 'react'
import { CreditCard as Edit2, Trash2 } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Badge, Button } from '../../../ui'
import type { BankCredit } from '../../../../lib/supabase'

const CREDIT_STATUS_CONFIG: Record<string, 'green' | 'red' | 'gray'> = {
  active: 'green',
  defaulted: 'red',
}

interface CreditFacilityCardProps {
  credit: BankCredit
  onEdit: (credit: BankCredit) => void
  onDelete: (id: string) => void
}

const CreditFacilityCard: React.FC<CreditFacilityCardProps> = ({ credit, onEdit, onDelete }) => {
  const { t } = useTranslation()
  const isMaturing = credit.maturity_date && differenceInDays(new Date(credit.maturity_date), new Date()) <= 90
  const paymentRatio = credit.amount > 0 ? ((credit.repaid_amount || 0) / credit.amount) * 100 : 0

  const statusVariant = CREDIT_STATUS_CONFIG[credit.status] ?? 'gray'

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2 flex-wrap gap-y-1">
            {credit.credit_type === 'equity' ? (
              <Badge variant="purple" size="sm">EQUITY</Badge>
            ) : (
              <Badge variant={
                credit.credit_type === 'construction_loan' ? 'blue' :
                credit.credit_type === 'term_loan' ? 'green' :
                credit.credit_type === 'bridge_loan' ? 'orange' : 'gray'
              } size="sm">
                {credit.credit_type.replace('_', ' ').toUpperCase()}
              </Badge>
            )}
            <Badge variant={credit.credit_seniority === 'senior' ? 'blue' : 'orange'} size="sm">
              {credit.credit_seniority?.toUpperCase() || 'SENIOR'}
            </Badge>
            <Badge variant={statusVariant} size="sm">
              {credit.status.toUpperCase()}
            </Badge>
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
          <p className="text-lg font-bold text-gray-900 dark:text-white">€{credit.amount.toLocaleString('hr-HR')}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{credit.interest_rate}% APR</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.investors.credit_facility_card.used_amount_label')}</p>
          <p className="text-sm font-medium text-blue-600">€{(credit.used_amount || 0).toLocaleString('hr-HR')}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {credit.amount > 0 ? ((credit.used_amount || 0) / credit.amount * 100).toFixed(1) : 0}% {t('funding.investors.credit_facility_card.drawn_label')}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.investors.credit_facility_card.repaid_to_bank_label')}</p>
          <p className="text-sm font-medium text-green-600">€{(credit.repaid_amount || 0).toLocaleString('hr-HR')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.investors.credit_facility_card.outstanding_debt_label')}</p>
          <p className="text-sm font-medium text-red-600">€{credit.outstanding_balance.toLocaleString('hr-HR')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.investors.credit_facility_card.available_to_use_label')}</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            €{(credit.amount - (credit.used_amount || 0)).toLocaleString('hr-HR')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{credit.repayment_type === 'yearly' ? t('funding.investors.credit_facility_card.annual_payment_label') : t('funding.investors.credit_facility_card.monthly_payment_label')}</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">€{credit.monthly_payment.toLocaleString('hr-HR')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.investors.credit_facility_card.maturity_date_label')}</p>
          <p className={`text-sm font-medium ${isMaturing ? 'text-orange-600' : 'text-gray-900 dark:text-white'}`}>
            {credit.maturity_date ? format(new Date(credit.maturity_date), 'MMM dd, yyyy') : t('funding.investors.credit_facility_card.na')}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-600 dark:text-gray-400">{t('funding.investors.credit_facility_card.repayment_progress_label')}</span>
          <span className="text-xs font-medium">{paymentRatio.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full"
            style={{ width: `${paymentRatio}%` }}
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
