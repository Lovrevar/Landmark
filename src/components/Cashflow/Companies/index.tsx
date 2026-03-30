import React from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Plus, DollarSign, TrendingUp, TrendingDown, Eye, Edit, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useCompanies } from './hooks/useCompanies'
import CompanyFormModal from './forms/CompanyFormModal'
import CompanyDetailsModal from './modals/CompanyDetailsModal'
import { PageHeader, StatGrid, LoadingSpinner, SearchInput, Button, StatCard, EmptyState, ConfirmDialog } from '../../ui'

const AccountingCompanies: React.FC = () => {
  const { t } = useTranslation()
  const {
    companies,
    loading,
    searchTerm,
    setSearchTerm,
    showAddModal,
    showDetailsModal,
    selectedCompany,
    editingCompany,
    formData,
    handleOpenAddModal,
    handleCloseAddModal,
    handleSubmit,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    handleViewDetails,
    handleCloseDetailsModal,
    handleAccountCountChange,
    handleBankAccountChange,
    handleFormDataChange,
    filteredCompanies,
    totalBalance,
    totalRevenue,
    totalProfit
  } = useCompanies()

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('companies.title')}
        description={t('companies.subtitle')}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => handleOpenAddModal()}>
            {t('companies.add_new')}
          </Button>
        }
      />

      <StatGrid columns={4}>
        <StatCard label={t('companies.stats.total_count')} value={companies.length} icon={Building2} />
        <StatCard label={t('companies.stats.total_balance')} value={`€${totalBalance.toLocaleString('hr-HR')}`} icon={DollarSign} color={totalBalance >= 0 ? 'green' : 'red'} />
        <StatCard label={t('companies.stats.total_revenue')} value={`€${totalRevenue.toLocaleString('hr-HR')}`} icon={TrendingUp} color="blue" />
        <StatCard label={t('companies.stats.profit_loss')} value={`€${totalProfit.toLocaleString('hr-HR')}`} icon={totalProfit >= 0 ? TrendingUp : TrendingDown} color={totalProfit >= 0 ? 'green' : 'red'} />
      </StatGrid>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder={t('companies.search')}
        />
      </div>

      {filteredCompanies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={searchTerm ? t('common.no_results') : t('companies.no_companies')}
          description={searchTerm ? t('companies.no_results_hint') : t('companies.no_companies_hint')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{company.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">OIB: {company.oib}</p>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('companies.card.current_balance')}</p>
                  <p className={`text-xl font-bold ${company.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{company.current_balance.toLocaleString('hr-HR')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <div className="flex items-center mb-1">
                      <ArrowUpCircle className="w-4 h-4 text-green-600 mr-1" />
                      <p className="text-xs text-green-700 dark:text-green-400">{t('companies.card.issued')}</p>
                    </div>
                    <p className="text-sm font-bold text-green-900 dark:text-green-300">€{company.total_income_paid.toLocaleString('hr-HR')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('companies.card.invoices_count', { count: company.total_income_invoices })}</p>
                  </div>

                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <div className="flex items-center mb-1">
                      <ArrowDownCircle className="w-4 h-4 text-red-600 mr-1" />
                      <p className="text-xs text-red-700 dark:text-red-400">{t('companies.card.paid_out')}</p>
                    </div>
                    <p className="text-sm font-bold text-red-900 dark:text-red-300">€{company.total_expense_paid.toLocaleString('hr-HR')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('companies.card.invoices_count', { count: company.total_expense_invoices })}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{t('companies.card.revenue_label')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">€{company.revenue.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('companies.card.profit_loss_label')}</span>
                    <span className={`font-medium ${company.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      €{company.profit.toLocaleString('hr-HR')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{t('companies.card.unpaid_income')}</span>
                    <span className="text-orange-600">€{company.total_income_unpaid.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{t('companies.card.unpaid_expense')}</span>
                    <span className="text-orange-600">€{company.total_expense_unpaid.toLocaleString('hr-HR')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="primary" size="sm" icon={Eye} className="flex-1" onClick={() => handleViewDetails(company)}>
                  {t('common.details')}
                </Button>
                <Button variant="ghost" size="icon-md" icon={Edit} onClick={() => handleOpenAddModal(company)} title="Uredi" />
                <Button variant="outline-danger" size="icon-md" icon={Trash2} onClick={() => handleDelete(company.id)} title="Obriši" />
              </div>
            </div>
          ))}
        </div>
      )}

      <CompanyFormModal
        show={showAddModal}
        editingCompany={editingCompany}
        formData={formData}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmit}
        onAccountCountChange={handleAccountCountChange}
        onBankAccountChange={handleBankAccountChange}
        onFormDataChange={handleFormDataChange}
      />

      <CompanyDetailsModal
        show={showDetailsModal}
        company={selectedCompany}
        onClose={handleCloseDetailsModal}
      />

      <ConfirmDialog
        show={!!pendingDeleteId}
        title={t('confirm.delete_title')}
        message={t('companies.confirm_delete_message')}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        loading={deleting}
      />
    </div>
  )
}

export default AccountingCompanies
