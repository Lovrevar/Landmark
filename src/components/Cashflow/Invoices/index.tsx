import React from 'react'
import { LoadingSpinner, PageHeader, ConfirmDialog } from '../../ui'
import { RetailInvoiceFormModal } from './Forms/RetailInvoiceFormModal'
import BankInvoiceFormModal from '../Banks/Forms/BankInvoiceFormModal'
import { LandPurchaseFormModal } from './Forms/LandPurchaseFormModal'
import { useInvoices } from './Hooks/useInvoices'
import { InvoiceFormModal } from './Forms/InvoiceFormModal'
import { PaymentFormModal } from '../Payments/Forms/PaymentFormModal'
import { InvoiceDetailView } from './InvoiceDetailView'
import { InvoiceTable } from './InvoiceTable'
import { InvoiceFilters } from './InvoiceFilters'
import { InvoiceStats } from './InvoiceStats'
import { ColumnMenuDropdown } from '../Components/ColumnMenuDropdown'
import { InvoiceActionButtons } from './InvoiceActionButtons'
import { InvoicePagination } from './InvoicePagination'
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
} from '../Services/invoiceHelpers'

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
    filterDirection,
    filterCategory,
    filterStatus,
    filterCompany,
    sortField,
    sortDirection,
    showColumnMenu,
    showInvoiceModal,
    isOfficeInvoice,
    showRetailInvoiceModal,
    showBankInvoiceModal,
    showLandPurchaseModal,
    editingInvoice,
    viewingInvoice,
    showPaymentModal,
    payingInvoice,
    formData,
    paymentFormData,
    visibleColumns,
    setSearchTerm,
    setFilterDirection,
    setFilterCategory,
    setFilterStatus,
    setFilterCompany,
    setSortField,
    setSortDirection,
    setShowColumnMenu,
    setShowInvoiceModal,
    setIsOfficeInvoice,
    setShowRetailInvoiceModal,
    setShowBankInvoiceModal,
    setShowLandPurchaseModal,
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
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    fetchData
  } = useInvoices()

  const toggleColumn = (column: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }))
  }

  const handleSort = (field: 'due_date' | 'invoice_number') => {
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

    if (sortField === 'invoice_number') {
      const numA = a.invoice_number || ''
      const numB = b.invoice_number || ''
      return sortDirection === 'asc'
        ? numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' })
        : numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' })
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
    <div className="space-y-6 max-w-full">
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
              onNewLandPurchaseInvoice={() => setShowLandPurchaseModal(true)}
              onNewInvoice={() => handleOpenModal()}
            />
          </div>
        }
      />

      <InvoiceStats
        filteredTotalCount={filteredTotalCount}
        filteredUnpaidAmount={filteredUnpaidAmount}
        totalUnpaidAmount={totalUnpaidAmount}
        filterDirection={filterDirection}
      />

      <InvoiceFilters
        searchTerm={searchTerm}
        filterDirection={filterDirection}
        filterCategory={filterCategory}
        filterStatus={filterStatus}
        filterCompany={filterCompany}
        companies={companies}
        onSearchChange={setSearchTerm}
        onDirectionChange={setFilterDirection}
        onCategoryChange={setFilterCategory}
        onStatusChange={(value) => setFilterStatus(value as 'ALL' | 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID_AND_PARTIAL')}
        onCompanyChange={setFilterCompany}
        onClearFilters={() => {
          setSearchTerm('')
          setFilterCategory('ALL')
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
        filterDirection={filterDirection}
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
        banks={banks}
        projects={projects}
        contracts={contracts}
        milestones={milestones}
        refunds={refunds}
        invoiceCategories={invoiceCategories}
        customerApartments={customerApartments as unknown as { id: string; number: string; price: number }[]}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        onFormChange={(data) => setFormData(data as unknown as typeof formData)}
        getCustomerProjects={(customerId) => getCustomerProjects(customerId, projects, customerSales)}
        getCustomerApartmentsByProject={(customerId, projectId) => getCustomerApartmentsByProject(customerId, projectId, customerApartments) as unknown as { id: string; number: string; price: number }[]}
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
        onFormChange={(data) => setPaymentFormData(data as unknown as typeof paymentFormData)}
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
          onClose={() => {
            setShowRetailInvoiceModal(false)
            setEditingInvoice(null)
          }}
          onSuccess={() => {
            setShowRetailInvoiceModal(false)
            setEditingInvoice(null)
            fetchData()
          }}
          editingInvoice={editingInvoice}
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

      {showLandPurchaseModal && (
        <LandPurchaseFormModal
          isOpen={showLandPurchaseModal}
          onClose={() => setShowLandPurchaseModal(false)}
          onSuccess={() => {
            setShowLandPurchaseModal(false)
            fetchData()
          }}
        />
      )}

      <ConfirmDialog
        show={!!pendingDeleteId}
        title="Potvrda brisanja"
        message="Jeste li sigurni da želite obrisati ovaj račun?"
        confirmLabel="Da, obriši"
        cancelLabel="Odustani"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        loading={deleting}
      />
    </div>
  )
}

export default AccountingInvoices
