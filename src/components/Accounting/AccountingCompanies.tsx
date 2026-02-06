import React from 'react'
import { Building2, Plus, DollarSign, TrendingUp, TrendingDown, Eye, Edit, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useCompanies } from './hooks/useCompanies'
import CompanyFormModal from './forms/CompanyFormModal'
import CompanyDetailsModal from './views/CompanyDetailsModal'
import { PageHeader, StatGrid, LoadingSpinner, SearchInput, Button, StatCard, EmptyState, Card } from '../ui'

const AccountingCompanies: React.FC = () => {
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

  const totalExpensePaid = companies.reduce((sum, c) => sum + c.total_expense_paid, 0)

  if (loading) {
    return <LoadingSpinner message="Učitavanje..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moje firme"
        description="Financijski pregled svih firmi pod Landmarkom"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => handleOpenAddModal()}>
            Dodaj novu firmu
          </Button>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Ukupno firmi" value={companies.length} icon={Building2} />
        <StatCard label="Ukupno stanje" value={`€${totalBalance.toLocaleString('hr-HR')}`} icon={DollarSign} color={totalBalance >= 0 ? 'green' : 'red'} />
        <StatCard label="Ukupan promet" value={`€${totalRevenue.toLocaleString('hr-HR')}`} icon={TrendingUp} color="blue" />
        <StatCard label="Dobit/Gubitak" value={`€${totalProfit.toLocaleString('hr-HR')}`} icon={totalProfit >= 0 ? TrendingUp : TrendingDown} color={totalProfit >= 0 ? 'green' : 'red'} />
      </StatGrid>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder="Pretraži firme po imenu ili OIB-u..."
        />
      </div>

      {filteredCompanies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={searchTerm ? 'Nema rezultata pretrage' : 'Nema firmi'}
          description={searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvu firmu klikom na gumb iznad'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                  <p className="text-sm text-gray-600">OIB: {company.oib}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Trenutno stanje</p>
                  <p className={`text-xl font-bold ${company.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{company.current_balance.toLocaleString('hr-HR')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center mb-1">
                      <ArrowUpCircle className="w-4 h-4 text-green-600 mr-1" />
                      <p className="text-xs text-green-700">Izdano</p>
                    </div>
                    <p className="text-sm font-bold text-green-900">€{company.total_income_paid.toLocaleString('hr-HR')}</p>
                    <p className="text-xs text-gray-600">{company.total_income_invoices} računa</p>
                  </div>

                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="flex items-center mb-1">
                      <ArrowDownCircle className="w-4 h-4 text-red-600 mr-1" />
                      <p className="text-xs text-red-700">Plaćeno</p>
                    </div>
                    <p className="text-sm font-bold text-red-900">€{company.total_expense_paid.toLocaleString('hr-HR')}</p>
                    <p className="text-xs text-gray-600">{company.total_expense_invoices} računa</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Promet:</span>
                    <span className="font-medium text-gray-900">€{company.revenue.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Dobit/Gubitak:</span>
                    <span className={`font-medium ${company.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      €{company.profit.toLocaleString('hr-HR')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Neplaćeno (prihod):</span>
                    <span className="text-orange-600">€{company.total_income_unpaid.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Neplaćeno (rashod):</span>
                    <span className="text-orange-600">€{company.total_expense_unpaid.toLocaleString('hr-HR')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="primary" size="sm" icon={Eye} className="flex-1" onClick={() => handleViewDetails(company)}>
                  Detalji
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
    </div>
  )
}

export default AccountingCompanies
