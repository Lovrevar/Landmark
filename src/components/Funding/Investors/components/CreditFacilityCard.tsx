import React from 'react'
import { CreditCard as Edit2, Trash2 } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
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
  const isMaturing = credit.maturity_date && differenceInDays(new Date(credit.maturity_date), new Date()) <= 90
  const paymentRatio = credit.amount > 0 ? ((credit.repaid_amount || 0) / credit.amount) * 100 : 0

  const statusVariant = CREDIT_STATUS_CONFIG[credit.status] ?? 'gray'

  return (
    <div className="border border-gray-200 rounded-lg p-4">
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
              <Badge variant="orange" size="sm">MATURING SOON</Badge>
            )}
          </div>
          {credit.credit_name && (
            <p className="text-base font-semibold text-gray-900 mb-1">{credit.credit_name}</p>
          )}
          <p className="text-sm text-gray-600 mb-2">{credit.purpose}</p>
          {credit.accounting_companies && (
            <p className="text-xs text-gray-500 mb-1">Company: {credit.accounting_companies.name}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</p>
          <p className="text-sm text-gray-600">{credit.interest_rate}% APR</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500">Used Amount</p>
          <p className="text-sm font-medium text-blue-600">€{(credit.used_amount || 0).toLocaleString('hr-HR')}</p>
          <p className="text-xs text-gray-400 mt-1">
            {credit.amount > 0 ? ((credit.used_amount || 0) / credit.amount * 100).toFixed(1) : 0}% drawn
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Repaid to Bank</p>
          <p className="text-sm font-medium text-green-600">€{(credit.repaid_amount || 0).toLocaleString('hr-HR')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Outstanding Debt</p>
          <p className="text-sm font-medium text-red-600">€{credit.outstanding_balance.toLocaleString('hr-HR')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Available to Use</p>
          <p className="text-sm font-medium text-gray-900">
            €{(credit.amount - (credit.used_amount || 0)).toLocaleString('hr-HR')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 pt-3 border-t border-gray-100">
        <div>
          <p className="text-xs text-gray-500">{credit.repayment_type === 'yearly' ? 'Annual' : 'Monthly'} Payment</p>
          <p className="text-sm font-medium text-gray-900">€{credit.monthly_payment.toLocaleString('hr-HR')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Maturity Date</p>
          <p className={`text-sm font-medium ${isMaturing ? 'text-orange-600' : 'text-gray-900'}`}>
            {credit.maturity_date ? format(new Date(credit.maturity_date), 'MMM dd, yyyy') : 'N/A'}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-600">Repayment Progress</span>
          <span className="text-xs font-medium">{paymentRatio.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full"
            style={{ width: `${paymentRatio}%` }}
          ></div>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-200 flex gap-2">
        <Button icon={Edit2} onClick={() => onEdit(credit)} size="sm">Edit</Button>
        <Button icon={Trash2} variant="danger" onClick={() => onDelete(credit.id)} size="sm" />
      </div>
    </div>
  )
}

export default CreditFacilityCard
