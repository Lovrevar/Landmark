import React from 'react'
import { DollarSign, TrendingUp } from 'lucide-react'
import { CompanyStats } from '../types/companyTypes'
import { Modal, Button, Badge, StatCard, StatGrid } from '../../ui'

interface CompanyDetailsModalProps {
  show: boolean
  company: CompanyStats | null
  onClose: () => void
}

const CompanyDetailsModal: React.FC<CompanyDetailsModalProps> = ({ show, company, onClose }) => {
  if (!company) return null

  return (
    <Modal show={show} onClose={onClose} size="full">
      <Modal.Header
        title={company.name}
        subtitle={`OIB: ${company.oib}`}
        onClose={onClose}
      />

      <Modal.Body>
        <StatGrid columns={5}>
          <StatCard
            label="Početno stanje"
            value={`€${company.initial_balance.toLocaleString('hr-HR')}`}
            color="blue"
          />
          <StatCard
            label="Izdano računa"
            value={`€${company.total_income_paid.toLocaleString('hr-HR')}`}
            color="green"
          />
          <StatCard
            label="Plaćeno računa"
            value={`€${company.total_expense_paid.toLocaleString('hr-HR')}`}
            color="red"
          />
          <StatCard
            label="Trenutno stanje"
            value={`€${company.current_balance.toLocaleString('hr-HR')}`}
            color="gray"
          />
          <StatCard
            label={company.profit >= 0 ? 'Dobit' : 'Gubitak'}
            value={`€${Math.abs(company.profit).toLocaleString('hr-HR')}`}
            color={company.profit >= 0 ? 'green' : 'red'}
          />
        </StatGrid>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Bankovni računi ({company.bank_accounts.length})
          </h3>
          {company.bank_accounts.length === 0 ? (
            <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">Nema dodanih bankovnih računa</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {company.bank_accounts.map((account) => (
                <div key={account.id} className="bg-white border-2 border-blue-200 rounded-lg p-4">
                  <p className="font-semibold text-gray-900 mb-2">{account.bank_name}</p>
                  {account.account_number && (
                    <p className="text-xs text-gray-500 mb-2">{account.account_number}</p>
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Početno:</span>
                      <span className="font-medium text-gray-900">€{account.initial_balance.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Trenutno:</span>
                      <span className={`font-bold ${account.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        €{account.current_balance.toLocaleString('hr-HR')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Krediti ({company.credits.length})
          </h3>
          {company.credits.length === 0 ? (
            <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">Nema dodanih kredita</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {company.credits.map((credit) => {
                const usedAmount = credit.used_amount || 0
                const available = credit.amount - usedAmount
                const utilizationPercent = credit.amount > 0 ? (usedAmount / credit.amount) * 100 : 0
                const isExpired = new Date(credit.maturity_date) < new Date()
                const isDisbursedToAccount = credit.disbursed_to_account || false

                return (
                  <div key={credit.id} className="bg-white border-2 border-orange-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-gray-900">{credit.credit_name}</p>
                      {isExpired && (
                        <Badge variant="red" size="sm">ISTEKAO</Badge>
                      )}
                    </div>
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{isDisbursedToAccount ? 'Iznos Kredita:' : 'Limit:'}</span>
                        <span className="font-medium text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</span>
                      </div>
                      {!isDisbursedToAccount && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Iskorišteno:</span>
                            <span className="font-medium text-orange-600">€{usedAmount.toLocaleString('hr-HR')}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Dostupno:</span>
                            <span className="font-bold text-green-600">€{available.toLocaleString('hr-HR')}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Kamata:</span>
                            <span className="font-medium text-gray-900">{credit.interest_rate}%</span>
                          </div>
                        </>
                      )}
                    </div>

                    {isDisbursedToAccount && credit.allocations && credit.allocations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Namjena:</p>
                        <div className="space-y-1">
                          {credit.allocations.map((allocation) => (
                            <div key={allocation.id} className="flex justify-between text-xs">
                              <span className="text-gray-600">{allocation.project?.name || 'OPEX'}:</span>
                              <span className="font-medium text-gray-900">€{allocation.allocated_amount.toLocaleString('hr-HR')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isDisbursedToAccount && (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              utilizationPercent >= 90 ? 'bg-red-500' :
                              utilizationPercent >= 70 ? 'bg-orange-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-right">{utilizationPercent.toFixed(1)}% iskorišteno</p>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer sticky>
        <Button variant="secondary" onClick={onClose}>
          Zatvori
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default CompanyDetailsModal
