import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Building2, CreditCard, DollarSign, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp
} from 'lucide-react'
import { Alert, Button, LoadingSpinner, PageHeader, StatGrid, StatCard, EmptyState, ErrorState } from '../../ui'
import { formatEuro } from '../../../utils/formatters'
import { toErrorMessage } from '../../../lib/errorMessage'
import { useBanks } from './hooks/useBanks'
import useBankeCredits from './hooks/useBankeCredits'
import BankCreditFormModal from './forms/BankCreditFormModal'
import { CreditBadges, CreditUsageTiles, CreditDetailsGrid } from '../../Funding/Investments/CreditSummary'
import AllocationRow from '../../Funding/Investments/AllocationRow'
import CreditDisbursements from '../../Funding/Investments/CreditDisbursements'
import CreditRepayments from '../../Funding/Investments/CreditRepayments'
import CreditExpenses from '../../Funding/Investments/CreditExpenses'

const AccountingBanks: React.FC = () => {
  const { t } = useTranslation()
  const {
    banks: banksMeta,
    companies,
    loading: banksLoading,
    error: banksError,
    refetch: refetchBanks,
    showCreditForm,
    editingCredit,
    newCredit,
    setNewCredit,
    addCredit,
    resetCreditForm
  } = useBanks()

  const {
    banks, credits, allocations, disbursedAmounts,
    loading: creditsLoading, error: creditsError, refetch: refetchCredits,
  } = useBankeCredits()

  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())
  const [expandedCredits, setExpandedCredits] = useState<Set<string>>(new Set())
  const [expandedAllocations, setExpandedAllocations] = useState<Set<string>>(new Set())

  const loading = banksLoading || creditsLoading
  const error = banksError ?? creditsError

  const retry = () => {
    void refetchBanks()
    void refetchCredits()
  }

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  // Every figure on this page is a sum over `banksMeta` / `banks`. With neither loaded the
  // page would report a bank with no credit lines and no debt.
  const loadFailedEmpty = !!error && banksMeta.length === 0 && banks.length === 0

  const totalCreditAcrossAllBanks = banksMeta.reduce((sum, b) => sum + b.total_credit_limit, 0)
  const totalUsedAcrossAllBanks = banksMeta.reduce((sum, b) => sum + b.total_used, 0)
  const totalRepaidAcrossAllBanks = banksMeta.reduce((sum, b) => sum + b.total_repaid, 0)
  const totalOutstandingAcrossAllBanks = banksMeta.reduce((sum, b) => sum + b.total_outstanding, 0)

  const toggleBank = (bankId: string) => {
    setExpandedBanks((prev) => {
      const next = new Set(prev)
      if (next.has(bankId)) next.delete(bankId)
      else next.add(bankId)
      return next
    })
  }

  const toggleCredit = (creditId: string) => {
    setExpandedCredits((prev) => {
      const next = new Set(prev)
      if (next.has(creditId)) next.delete(creditId)
      else next.add(creditId)
      return next
    })
  }

  const toggleAllocation = (key: string) => {
    setExpandedAllocations((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteAllocation = (_allocationId: string, _creditId: string) => {
    // read-only view - allocations cannot be deleted from cashflow banke
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('banks.index.title')}
        description={t('banks.index.subtitle')}
      />

      {error && !loadFailedEmpty && (
        <Alert variant="error" title={t('common.load_error_title')}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex-1">{toErrorMessage(error, t('common.load_error_description'))}</span>
            <Button size="sm" variant="secondary" onClick={retry}>{t('common.retry')}</Button>
          </div>
        </Alert>
      )}

      {!loadFailedEmpty && (
      <StatGrid columns={4}>
        <StatCard label={t('banks.index.stats.total_credit_limit')} value={formatEuro(totalCreditAcrossAllBanks)} icon={CreditCard} />
        <StatCard label={t('banks.index.stats.total_used')} value={formatEuro(totalUsedAcrossAllBanks)} icon={TrendingDown} color="blue" />
        <StatCard label={t('banks.index.stats.total_repaid')} value={formatEuro(totalRepaidAcrossAllBanks)} icon={TrendingUp} color="green" />
        <StatCard label={t('banks.index.stats.total_outstanding')} value={formatEuro(totalOutstandingAcrossAllBanks)} icon={DollarSign} color="red" />
      </StatGrid>
      )}

      {loadFailedEmpty ? (
        <ErrorState onRetry={retry} />
      ) : banks.length === 0 ? (
        <EmptyState icon={Building2} title={t('banks.no_banks')} description={t('banks.no_banks_description')} />
      ) : (
        <div className="space-y-4">
          {banks.map((bank) => {
            const bankCredits = credits.filter((c) => c.bank_id === bank.id)
            if (bankCredits.length === 0) return null

            const isBankExpanded = expandedBanks.has(bank.id)
            const bankTotal = bankCredits.reduce((s, c) => s + c.amount, 0)
            const bankUsed = bankCredits.reduce((s, c) => s + c.used_amount, 0)
            const bankOutstanding = bankCredits.reduce((s, c) => s + c.outstanding_balance, 0)

            return (
              <div key={bank.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => toggleBank(bank.id)}
                  className="w-full p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-xl"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">{bank.name}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {bankCredits.length} {bankCredits.length === 1 ? t('banks.index.bank.credits_count_singular') : t('banks.index.bank.credits_count_plural')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-8">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('banks.index.bank.total_label')}</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatEuro(bankTotal)}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('banks.index.bank.used_label')}</p>
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatEuro(bankUsed)}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('banks.index.bank.debt_label')}</p>
                      <p className={`text-sm font-semibold ${bankOutstanding > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{formatEuro(bankOutstanding)}</p>
                    </div>
                    {isBankExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                </button>

                {isBankExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-5 space-y-4">
                    {bankCredits.map((credit) => {
                      const isExpanded = expandedCredits.has(credit.id)
                      const creditAllocations = allocations.get(credit.id) || []
                      const totalAllocated = creditAllocations.reduce((sum, a) => sum + a.allocated_amount, 0)
                      const totalUsedInAllocations = creditAllocations.reduce((sum, a) => sum + (a.used_amount || 0), 0)
                      const unallocatedDisbursements = disbursedAmounts.get(credit.id) || 0

                      return (
                        <div key={credit.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <button
                                  onClick={() => toggleCredit(credit.id)}
                                  className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors duration-200"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-6 h-6 text-blue-600" />
                                  ) : (
                                    <ChevronDown className="w-6 h-6 text-blue-600" />
                                  )}
                                </button>
                                <div>
                                  <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                      {credit.credit_name || t('funding.investments.unnamed_credit')}
                                    </h3>
                                    <CreditBadges credit={credit} />
                                  </div>
                                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    {bank.name}
                                    {credit.company && ` • ${credit.company.name}`}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatEuro(credit.amount)}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{t('banks.index.credit.investment_amount')}</p>
                              </div>
                            </div>

                            <CreditUsageTiles
                              credit={credit}
                              totalAllocated={totalAllocated}
                              usedInAllocations={totalUsedInAllocations}
                              unallocatedDisbursements={unallocatedDisbursements}
                            />
                          </div>

                          {isExpanded && (
                            <div className="p-6">
                              <CreditDetailsGrid credit={credit} />

                              {creditAllocations.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
                                    {t('banks.index.credit.allocations_heading', { count: creditAllocations.length })}
                                  </h4>
                                  <div className="space-y-3">
                                    {creditAllocations.map((allocation) => {
                                      const allocationKey = `${credit.id}-${allocation.id}`
                                      return (
                                        <AllocationRow
                                          key={allocation.id}
                                          allocation={allocation}
                                          credit={credit}
                                          allocationKey={allocationKey}
                                          isExpanded={expandedAllocations.has(allocationKey)}
                                          onToggle={toggleAllocation}
                                          onDelete={handleDeleteAllocation}
                                        />
                                      )
                                    })}
                                  </div>
                                </div>
                              )}

                              <CreditDisbursements creditId={credit.id} />
                              <CreditRepayments creditId={credit.id} />
                              <CreditExpenses creditId={credit.id} />

                              {credit.purpose && (
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{t('banks.index.credit.purpose_heading')}</h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{credit.purpose}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <BankCreditFormModal
        showCreditForm={showCreditForm}
        editingCredit={editingCredit}
        newCredit={newCredit}
        setNewCredit={setNewCredit}
        banks={banksMeta}
        companies={companies}
        addCredit={addCredit}
        resetCreditForm={resetCreditForm}
      />
    </div>
  )
}

export default AccountingBanks
