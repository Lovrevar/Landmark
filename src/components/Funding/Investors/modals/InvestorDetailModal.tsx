import React from 'react'
import { Mail, Phone, CreditCard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Modal, EmptyState } from '../../../ui'
import type { BankCredit } from '../../../../lib/supabase'
import type { BankWithCredits } from '../types'
import { getCreditRiskLevel } from '../utils/creditCalculations'
import CreditFacilityCard from '../components/CreditFacilityCard'

interface InvestorDetailModalProps {
  bank: BankWithCredits | null
  allBanks: BankWithCredits[]
  onClose: () => void
  onEditCredit: (credit: BankCredit) => void
  onDeleteCredit: (id: string) => void
}

const InvestorDetailModal: React.FC<InvestorDetailModalProps> = ({
  bank,
  allBanks,
  onClose,
  onEditCredit,
  onDeleteCredit,
}) => {
  const { t } = useTranslation()
  const totalDebt = allBanks.reduce((sum, b) => sum + (b.outstanding_debt ?? 0), 0)
  const concentration = bank && totalDebt > 0
    ? ((bank.outstanding_debt / totalDebt) * 100).toFixed(1)
    : '0'

  const riskLevel = bank ? getCreditRiskLevel(bank.credit_utilization) : null

  return (
    <Modal show={!!bank} onClose={onClose} size="xl">
      {bank && (
        <>
          <Modal.Header
            title={bank.name}
            subtitle={bank.contact_person ?? undefined}
            onClose={onClose}
          />

          <Modal.Body>
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-center">
                <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-1" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{bank.contact_email}</span>
              </div>
              <div className="flex items-center">
                <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-1" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{bank.contact_phone}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">{t('funding.investors.detail_modal.credit_facilities_heading')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-300">{t('funding.investors.detail_modal.credit_utilized_label')}</span>
                    <span className="font-medium text-green-700 dark:text-green-400">€{bank.credit_utilized.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-300">{t('funding.investors.detail_modal.outstanding_label')}</span>
                    <span className="font-medium text-red-700 dark:text-red-400">€{bank.outstanding_debt.toLocaleString('hr-HR')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 dark:text-green-300 mb-3">{t('funding.investors.detail_modal.credit_overview_heading')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-400">{t('funding.investors.detail_modal.active_credits_label')}</span>
                    <span className="font-medium text-green-900 dark:text-green-300">{bank.active_credits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-400">{t('funding.investors.detail_modal.total_credits_label')}</span>
                    <span className="font-medium text-green-900 dark:text-green-300">{bank.total_credits}</span>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-orange-900 dark:text-orange-300 mb-3">{t('funding.investors.detail_modal.risk_assessment_heading')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-400">{t('funding.investors.detail_modal.credit_risk_label')}</span>
                    <span className={`font-medium ${riskLevel?.className}`}>
                      {riskLevel?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-400">{t('funding.investors.detail_modal.concentration_label')}</span>
                    <span className="font-medium text-orange-900 dark:text-orange-300">
                      {concentration}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">{t('funding.investors.detail_modal.credit_facilities_heading')}</h4>
              {bank.credits.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title={t('funding.investors.detail_modal.no_credit_facilities_title')}
                  description={t('funding.investors.detail_modal.no_credit_facilities_description')}
                />
              ) : (
                <div className="space-y-3">
                  {bank.credits.map((credit) => (
                    <CreditFacilityCard
                      key={credit.id}
                      credit={credit}
                      onEdit={onEditCredit}
                      onDelete={onDeleteCredit}
                    />
                  ))}
                </div>
              )}
            </div>
          </Modal.Body>
        </>
      )}
    </Modal>
  )
}

export default InvestorDetailModal
