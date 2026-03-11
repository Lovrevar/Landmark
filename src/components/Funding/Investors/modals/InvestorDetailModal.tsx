import React from 'react'
import { Mail, Phone, CreditCard } from 'lucide-react'
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
                <Mail className="w-4 h-4 text-gray-400 mr-1" />
                <span className="text-sm text-gray-600">{bank.contact_email}</span>
              </div>
              <div className="flex items-center">
                <Phone className="w-4 h-4 text-gray-400 mr-1" />
                <span className="text-sm text-gray-600">{bank.contact_phone}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3">Credit Facilities</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Credit Utilized:</span>
                    <span className="font-medium text-green-700">€{bank.credit_utilized.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Outstanding:</span>
                    <span className="font-medium text-red-700">€{bank.outstanding_debt.toLocaleString('hr-HR')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-3">Credit Overview</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-green-700">Active Credits:</span>
                    <span className="font-medium text-green-900">{bank.active_credits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total Credits:</span>
                    <span className="font-medium text-green-900">{bank.total_credits}</span>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="font-semibold text-orange-900 mb-3">Risk Assessment</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-orange-700">Credit Risk:</span>
                    <span className={`font-medium ${riskLevel?.className}`}>
                      {riskLevel?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700">Concentration:</span>
                    <span className="font-medium text-orange-900">
                      {concentration}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-4">Credit Facilities</h4>
              {bank.credits.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No credit facilities"
                  description="No credit facilities with this bank yet"
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
