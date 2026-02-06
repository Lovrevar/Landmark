import React from 'react'
import { LoadingSpinner, PageHeader } from '../ui'
import { RetailInvoiceFormModal } from './RetailInvoiceFormModal'
import BankInvoiceFormModal from './BankInvoiceFormModal'
import { useInvoices } from './hooks/useInvoices'
import { InvoiceFormModal } from './forms/InvoiceFormModal'
import { PaymentFormModal } from './forms/PaymentFormModal'
import { InvoiceDetailView } from './views/InvoiceDetailView'
import { InvoiceTable } from './views/InvoiceTable'
import { InvoiceFilters } from './views/InvoiceFilters'
import { InvoiceStats } from './views/InvoiceStats'
import { ColumnMenuDropdown } from './views/ColumnMenuDropdown'
import { InvoiceActionButtons } from './views/InvoiceActionButtons'
import { InvoicePagination } from './views/InvoicePagination'
import {
  getTypeColor,
  getTypeLabel,
  getStatusColor,
  getSupplierCustomerName,
  getCustomerProjects,
  getCustomerApartmentsByProject,
  getSupplierProjects,
  getSupplierContractsByProject,
  getMilestonesByContract,
  isOverdue,
  columnLabels
} from './utils/invoiceHelpers'

const AccountingInvoices: React.FC = () => {
  const {
    invoices,
    companies,
    companyBankAccounts,
    companyCredits,
    creditAllocations,
    refunds,
    suppliers,
    officeSuppliers,
    customers,
    investors,
    banks,
    projects,
    contracts,
    milestones,
    customerSales,
    customerApartments,
    invoiceCategories,
    loading,
    currentPage,
    totalCount,
    filteredTotalCount,
    filteredUnpaidAmount,
    totalUnpaidAmount,
    pageSize,
    searchTerm,
    filterType,
    filterStatus,
    filterCompany,
    sortField,
    sortDirection,
    showColumnMenu,
    showInvoiceModal,
    isOfficeInvoice,
    showRetailInvoiceModal,
    showBankInvoiceModal,
    editingInvoice,
    viewingInvoice,
    showPaymentModal,
    payingInvoice,
    formData,
    paymentFormData,
    visibleColumns,
    setSearchTerm,
    setFilterType,
    setFilterStatus,
    setFilterCompany,
    setSortField,
    setSortDirection,
    setShowColumnMenu,
    setShowInvoiceModal,
    setIsOfficeInvoice,
    setShowRetailInvoiceModal,
    setShowBankInvoiceModal,
    setEditingInvoice,
    setCurrentPage,
    setFormData,
    setPaymentFormData,
    setVisibleColumns,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    fetchCreditAllocationsHandler,
    handleOpenPaymentModal,
    handleClosePaymentModal,
    handleViewInvoice,
    handleCloseViewModal,
    handlePaymentSubmit,
    handleDelete,
    fetchData
  } = useInvoices()

  const toggleColumn = (column: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }))
  }

  const handleSort = (field: 'due_date') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredInvoices = [...invoices].sort((a, b) => {
    if (!sortField) return 0

    if (sortField === 'due_date') {
      const dateA = new Date(a.due_date).getTime()
      const dateB = new Date(b.due_date).getTime()
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
    }

    return 0
  })

  const handleNewOfficeInvoice = () => {
    setIsOfficeInvoice(true)
    setFormData({
      ...formData,
      invoice_type: 'INCOMING_OFFICE',
      supplier_id: '',
      customer_id: '',
      investor_id: '',
      bank_id: '',
      apartment_id: '',
      contract_id: '',
      milestone_id: '',
      project_id: '',
      refund_id: '',
      category: ''
    })
    setEditingInvoice(null)
    document.body.style.overflow = 'hidden'
    setShowInvoiceModal(true)
  }

  if (loading) {
    return <LoadingSpinner message="Učitavanje..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Računi"
        description="Upravljanje ulaznim i izlaznim računima"
        actions={
          <div className="flex items-center gap-2">
            <ColumnMenuDropdown
              showColumnMenu={showColumnMenu}
              visibleColumns={visibleColumns}
              columnLabels={columnLabels}
              onToggleMenu={() => setShowColumnMenu(!showColumnMenu)}
              onToggleColumn={toggleColumn}
            />
            <InvoiceActionButtons
              onNewOfficeInvoice={handleNewOfficeInvoice}
              onNewRetailInvoice={() => setShowRetailInvoiceModal(true)}
              onNewBankInvoice={() => setShowBankInvoiceModal(true)}
              onNewInvoice={() => handleOpenModal()}
            />
          </div>
        }
      />

      <InvoiceStats
        filteredTotalCount={filteredTotalCount}
        filteredUnpaidAmount={filteredUnpaidAmount}
        totalUnpaidAmount={totalUnpaidAmount}
      />

      <InvoiceFilters
        searchTerm={searchTerm}
        filterType={filterType}
        filterStatus={filterStatus}
        filterCompany={filterCompany}
        companies={companies}
        onSearchChange={setSearchTerm}
        onTypeChange={(value) => setFilterType(value as any)}
        onStatusChange={(value) => setFilterStatus(value as any)}
        onCompanyChange={setFilterCompany}
        onClearFilters={() => {
          setSearchTerm('')
          setFilterType('ALL')
          setFilterStatus('ALL')
          setFilterCompany('ALL')
          setSortField(null)
          setSortDirection('asc')
        }}
      />

      <InvoiceTable
        invoices={filteredInvoices}
        visibleColumns={visibleColumns}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onView={handleViewInvoice}
        onEdit={handleOpenModal}
        onDelete={handleDelete}
        onPayment={handleOpenPaymentModal}
        getTypeColor={getTypeColor}
        getTypeLabel={getTypeLabel}
        getStatusColor={getStatusColor}
        getSupplierCustomerName={getSupplierCustomerName}
        isOverdue={isOverdue}
      />

      <InvoicePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={setCurrentPage}
      />

      <InvoiceFormModal
        show={showInvoiceModal}
        editingInvoice={editingInvoice}
        isOfficeInvoice={isOfficeInvoice}
        formData={formData}
        companies={companies}
        suppliers={suppliers}
        officeSuppliers={officeSuppliers}
        customers={customers}
        investors={investors}
        banks={banks}
        projects={projects}
        contracts={contracts}
        milestones={milestones}
        refunds={refunds}
        invoiceCategories={invoiceCategories}
        customerApartments={customerApartments}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        onFormChange={setFormData}
        getCustomerProjects={(customerId) => getCustomerProjects(customerId, projects, customerSales)}
        getCustomerApartmentsByProject={(customerId, projectId) => getCustomerApartmentsByProject(customerId, projectId, customerApartments)}
        getSupplierProjects={(supplierId) => getSupplierProjects(supplierId, projects, contracts)}
        getSupplierContractsByProject={(supplierId, projectId) => getSupplierContractsByProject(supplierId, projectId, contracts)}
        getMilestonesByContract={(contractId) => getMilestonesByContract(contractId, milestones)}
      />

      <PaymentFormModal
        show={showPaymentModal}
        payingInvoice={payingInvoice}
        paymentFormData={paymentFormData}
        companies={companies}
        companyBankAccounts={companyBankAccounts}
        companyCredits={companyCredits}
        creditAllocations={creditAllocations}
        onClose={handleClosePaymentModal}
        onSubmit={handlePaymentSubmit}
        onFormChange={setPaymentFormData}
        onCreditChange={fetchCreditAllocationsHandler}
      />

      <InvoiceDetailView
        invoice={viewingInvoice}
        onClose={handleCloseViewModal}
        getTypeColor={getTypeColor}
        getTypeLabel={getTypeLabel}
        getStatusColor={getStatusColor}
        getSupplierCustomerName={getSupplierCustomerName}
        isOverdue={isOverdue}
      />

      {showRetailInvoiceModal && (
        <RetailInvoiceFormModal
          onClose={() => setShowRetailInvoiceModal(false)}
          onSuccess={() => {
            setShowRetailInvoiceModal(false)
            fetchData()
          }}
        />
      )}

      {showBankInvoiceModal && (
        <BankInvoiceFormModal
          onClose={() => setShowBankInvoiceModal(false)}
          onSuccess={() => {
            setShowBankInvoiceModal(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

export default AccountingInvoices
