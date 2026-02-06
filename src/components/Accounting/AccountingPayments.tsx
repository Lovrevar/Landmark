import React from 'react'
import { Plus, Search, Columns, Check, X } from 'lucide-react'
import DateInput from '../Common/DateInput'
import { usePayments } from './hooks/usePayments'
import AccountingPaymentFormModal from './forms/AccountingPaymentFormModal'
import PaymentStatsCards from './components/PaymentStatsCards'
import PaymentTable from './views/PaymentTable'
import { columnLabels } from './utils/paymentHelpers'

const AccountingPayments: React.FC = () => {
  const {
    payments,
    invoices,
    companies,
    companyBankAccounts,
    companyCredits,
    loading,
    searchTerm,
    setSearchTerm,
    filterMethod,
    setFilterMethod,
    filterInvoiceType,
    setFilterInvoiceType,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showColumnMenu,
    setShowColumnMenu,
    showPaymentModal,
    editingPayment,
    formData,
    setFormData,
    visibleColumns,
    toggleColumn,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    handleDelete,
    filteredPayments,
    resetDateFilters
  } = usePayments()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Učitavanje...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plaćanja</h1>
          <p className="text-sm text-gray-600 mt-1">Pregled svih izvršenih plaćanja</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative column-menu-container">
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              <Columns className="w-5 h-5 mr-2" />
              Polja
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-700">Prikaži kolone</p>
                </div>
                {Object.entries(columnLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleColumn(key)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="text-gray-700">{label}</span>
                    {visibleColumns[key] && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo plaćanje
          </button>
        </div>
      </div>

      <PaymentStatsCards payments={payments} />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Pretraži po broju računa, referenci..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">Svi načini plaćanja</option>
            <option value="WIRE">Virman</option>
            <option value="CASH">Gotovina</option>
            <option value="CHECK">Ček</option>
            <option value="CARD">Kartica</option>
          </select>

          <select
            value={filterInvoiceType}
            onChange={(e) => setFilterInvoiceType(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">Svi tipovi računa</option>
            <option value="EXPENSE">Ulazni</option>
            <option value="INCOME">Izlazni</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Datum OD</label>
            <DateInput
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Datum DO</label>
            <DateInput
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            {(dateFrom || dateTo) && (
              <button
                onClick={resetDateFilters}
                className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                <X className="w-4 h-4 mr-2" />
                Resetuj datume
              </button>
            )}
          </div>
        </div>
      </div>

      <PaymentTable
        payments={filteredPayments}
        visibleColumns={visibleColumns}
        onEdit={handleOpenModal}
        onDelete={handleDelete}
      />

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Prikazano: {filteredPayments.length} od {payments.length} plaćanja</span>
          <div className="flex items-center space-x-6 text-sm">
            <div>
              <span className="text-gray-600">Ukupan iznos filtriranih: </span>
              <span className="font-semibold text-green-600">
                €{filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('hr-HR')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <AccountingPaymentFormModal
        showModal={showPaymentModal}
        editingPayment={editingPayment}
        formData={formData}
        setFormData={setFormData}
        invoices={invoices}
        companies={companies}
        companyBankAccounts={companyBankAccounts}
        companyCredits={companyCredits}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default AccountingPayments
