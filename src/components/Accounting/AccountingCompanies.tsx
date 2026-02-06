import React from 'react'
import { Building2, Plus, Search, DollarSign, TrendingUp, TrendingDown, Eye, Edit, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useCompanies } from './hooks/useCompanies'
import CompanyFormModal from './forms/CompanyFormModal'
import CompanyDetailsModal from './views/CompanyDetailsModal'

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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moje firme</h1>
          <p className="text-sm text-gray-600 mt-1">Financijski pregled svih firmi pod Landmarkom</p>
        </div>
        <button
          onClick={() => handleOpenAddModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
        >
          <Plus className="w-5 h-5 mr-2" />
          Dodaj novu firmu
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno firmi</p>
              <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno stanje</p>
              <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{totalBalance.toLocaleString('hr-HR')}
              </p>
            </div>
            <DollarSign className={`w-8 h-8 ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupan promet</p>
              <p className="text-2xl font-bold text-blue-600">
                €{totalRevenue.toLocaleString('hr-HR')}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Dobit/Gubitak</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{totalProfit.toLocaleString('hr-HR')}
              </p>
            </div>
            {totalProfit >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Pretraži firme po imenu ili OIB-u..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'Nema rezultata pretrage' : 'Nema firmi'}
          </h3>
          <p className="text-gray-600">
            {searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvu firmu klikom na gumb iznad'}
          </p>
        </div>
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
                <button
                  onClick={() => handleViewDetails(company)}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Detalji
                </button>
                <button
                  onClick={() => handleOpenAddModal(company)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Uredi"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(company.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Obriši"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
