import React from 'react'
import { CreditCard as Edit2, Trash2, Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../ui'
import type { BankWithCredits } from '../types'

interface InvestorCardProps {
  bank: BankWithCredits
  onSelect: (bank: BankWithCredits) => void
  onEdit: (bank: BankWithCredits) => void
  onDelete: (id: string) => void
}

const InvestorCard: React.FC<InvestorCardProps> = ({ bank, onSelect, onEdit, onDelete }) => {
  const { t } = useTranslation()
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={() => onSelect(bank)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{bank.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{bank.contact_person}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{bank.contact_email}</p>
        </div>
        <div className="flex space-x-1">
          <Button
            size="icon-sm"
            variant="ghost"
            icon={Eye}
            onClick={(e) => { e.stopPropagation(); onSelect(bank) }}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            icon={Edit2}
            onClick={(e) => { e.stopPropagation(); onEdit(bank) }}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            icon={Trash2}
            onClick={(e) => { e.stopPropagation(); onDelete(bank.id) }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center">
          <p className="text-xl font-bold text-green-600">€{(bank.credit_utilized / 1000000).toFixed(1)}M</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('funding.investors.card.credit_utilized')}</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-red-600">€{(bank.outstanding_debt / 1000000).toFixed(1)}M</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('funding.investors.card.outstanding')}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.investors.card.credit_utilization')}</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{bank.credit_utilization.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              bank.credit_utilization > 80 ? 'bg-red-600' :
              bank.credit_utilization > 60 ? 'bg-orange-600' :
              'bg-green-600'
            }`}
            style={{ width: `${Math.min(100, bank.credit_utilization)}%` }}
          ></div>
        </div>
      </div>

      <div className="border-t dark:border-gray-700 pt-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.investors.card.active_credits')}</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{bank.active_credits}</span>
        </div>
      </div>
    </div>
  )
}

export default InvestorCard
