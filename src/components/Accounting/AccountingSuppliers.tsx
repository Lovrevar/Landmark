import React from 'react'
import { Users, Plus, DollarSign, Briefcase, Phone, FileText, Edit, Trash2, Eye, TrendingUp, ChevronLeft, ChevronRight, Store } from 'lucide-react'
import RetailSupplierModal from './RetailSupplierModal'
import SupplierFormModal from './forms/SupplierFormModal'
import SupplierDetailsModal from './views/SupplierDetailsModal'
import { useSuppliers } from './hooks/useSuppliers'
import { PageHeader, StatGrid, LoadingSpinner, SearchInput } from '../ui'

const AccountingSuppliers: React.FC = () => {
  const {
    suppliers,
    loading,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    showAddModal,
    showDetailsModal,
    selectedSupplier,
    editingSupplier,
    showRetailModal,
    setShowRetailModal,
    formData,
    setFormData,
    projects,
    phases,
    loadingProjects,
    filteredSuppliers,
    paginatedSuppliers,
    totalPages,
    startIndex,
    endIndex,
    fetchData,
    handleOpenAddModal,
    handleCloseAddModal,
    handleSubmit,
    handleDelete,
    handleViewDetails,
    handleCloseDetailsModal
  } = useSuppliers()

  if (loading) {
    return <LoadingSpinner message="Učitavanje..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dobavljači"
        description="Pregled svih dobavljača, ugovora i plaćanja"
        actions={
          <>
            <button
              onClick={() => handleOpenAddModal()}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
            >
              <Plus className="w-5 h-5 mr-2" />
              Novi dobavljač
            </button>
            <button
              onClick={() => setShowRetailModal(true)}
              className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 whitespace-nowrap"
            >
              <Store className="w-5 h-5 mr-2" />
              Novi Retail Dobavljač
            </button>
          </>
        }
      />

      <StatGrid columns={4}>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno dobavljača</p>
              <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno ugovora</p>
              <p className="text-2xl font-bold text-gray-900">
                {suppliers.reduce((sum, s) => sum + s.total_contracts, 0)}
              </p>
            </div>
            <Briefcase className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno plaćeno</p>
              <p className="text-2xl font-bold text-green-600">
                €{suppliers.reduce((sum, s) => sum + s.total_paid, 0).toLocaleString('hr-HR')}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno dugovi</p>
              <p className="text-2xl font-bold text-orange-600">
                €{suppliers.reduce((sum, s) => sum + s.total_remaining, 0).toLocaleString('hr-HR')}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </StatGrid>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder="Pretraži dobavljače..."
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm ? 'Nema rezultata pretrage' : 'Nema dobavljača'}
            </h3>
            <p className="text-gray-600">
              {searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvog dobavljača koristeći gumb iznad'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {paginatedSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between"
                  onClick={() => handleViewDetails(supplier)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
                      {supplier.source === 'retail' ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-800 rounded-full">Retail</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Site</span>
                      )}
                      {supplier.supplier_type && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">{supplier.supplier_type}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-1" />
                        {supplier.contact}
                      </div>
                      <div className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-1" />
                        {supplier.total_contracts} ugovora
                      </div>
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-1" />
                        {supplier.total_invoices} računa
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 mt-2 text-sm">
                      <div>
                        <span className="text-gray-600">Vrijednost: </span>
                        <span className="font-semibold text-gray-900">€{supplier.total_contract_value.toLocaleString('hr-HR')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Plaćeno: </span>
                        <span className="font-semibold text-green-600">€{supplier.total_paid.toLocaleString('hr-HR')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Dugovi: </span>
                        <span className="font-semibold text-orange-600">€{supplier.total_remaining.toLocaleString('hr-HR')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {supplier.source === 'site' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenAddModal(supplier)
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Uredi"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(supplier)
                      }}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Obriši"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Eye className="w-5 h-5 text-blue-600 ml-2" />
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prethodna
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sljedeća
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Prikazano <span className="font-medium">{startIndex + 1}</span> do <span className="font-medium">{Math.min(endIndex, filteredSuppliers.length)}</span> od{' '}
                      <span className="font-medium">{filteredSuppliers.length}</span> rezultata
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          if (totalPages <= 7) return true
                          if (page === 1 || page === totalPages) return true
                          if (page >= currentPage - 1 && page <= currentPage + 1) return true
                          return false
                        })
                        .map((page, index, array) => {
                          if (index > 0 && page - array[index - 1] > 1) {
                            return (
                              <React.Fragment key={`dots-${page}`}>
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                  ...
                                </span>
                                <button
                                  onClick={() => setCurrentPage(page)}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    currentPage === page
                                      ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            )
                          }
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === page
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          )
                        })}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <SupplierFormModal
        showModal={showAddModal}
        editingSupplier={editingSupplier}
        formData={formData}
        setFormData={setFormData}
        projects={projects}
        phases={phases}
        loadingProjects={loadingProjects}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmit}
      />

      <SupplierDetailsModal
        showModal={showDetailsModal}
        supplier={selectedSupplier}
        onClose={handleCloseDetailsModal}
      />

      {showRetailModal && (
        <RetailSupplierModal
          onClose={() => setShowRetailModal(false)}
          onSuccess={() => {
            setShowRetailModal(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

export default AccountingSuppliers
