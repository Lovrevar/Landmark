import React from 'react'
import { Users, Plus, DollarSign, Briefcase, Phone, FileText, Edit, Trash2, Eye, TrendingUp, ChevronLeft, ChevronRight, Store } from 'lucide-react'
import RetailSupplierModal from './RetailSupplierModal'
import SupplierFormModal from './forms/SupplierFormModal'
import SupplierDetailsModal from './views/SupplierDetailsModal'
import { useSuppliers } from './hooks/useSuppliers'
import { PageHeader, StatGrid, LoadingSpinner, SearchInput, Button, StatCard, EmptyState, Badge } from '../ui'

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
            <Button variant="primary" icon={Plus} onClick={() => handleOpenAddModal()}>
              Novi dobavljač
            </Button>
            <Button variant="primary" icon={Store} onClick={() => setShowRetailModal(true)} className="bg-teal-600 hover:bg-teal-700">
              Novi Retail Dobavljač
            </Button>
          </>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Ukupno dobavljača" value={suppliers.length} icon={Users} />
        <StatCard label="Ukupno ugovora" value={suppliers.reduce((sum, s) => sum + s.total_contracts, 0)} icon={Briefcase} color="gray" />
        <StatCard label="Ukupno plaćeno" value={`€${suppliers.reduce((sum, s) => sum + s.total_paid, 0).toLocaleString('hr-HR')}`} icon={DollarSign} color="green" />
        <StatCard label="Ukupno dugovi" value={`€${suppliers.reduce((sum, s) => sum + s.total_remaining, 0).toLocaleString('hr-HR')}`} icon={TrendingUp} color="yellow" />
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
          <EmptyState
            icon={Users}
            title={searchTerm ? 'Nema rezultata pretrage' : 'Nema dobavljača'}
            description={searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvog dobavljača koristeći gumb iznad'}
          />
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
                      <Badge variant={supplier.source === 'retail' ? 'teal' : 'blue'} size="sm">
                        {supplier.source === 'retail' ? 'Retail' : 'Site'}
                      </Badge>
                      {supplier.supplier_type && (
                        <Badge variant="gray" size="sm">{supplier.supplier_type}</Badge>
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
                      <Button variant="ghost" size="icon-sm" icon={Edit} title="Uredi" onClick={(e) => { e.stopPropagation(); handleOpenAddModal(supplier) }} />
                    )}
                    <Button variant="outline-danger" size="icon-sm" icon={Trash2} title="Obriši" onClick={(e) => { e.stopPropagation(); handleDelete(supplier) }} />
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
