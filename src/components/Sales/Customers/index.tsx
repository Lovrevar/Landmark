import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Mail } from 'lucide-react'
import { PageHeader, SearchInput, Button, ConfirmDialog } from '../../ui'
import { CustomerCategory } from './types'
import { useCustomerData } from './hooks/useCustomerData'
import { useToast } from '../../../contexts/ToastContext'
import { CategoryTabs } from './CategoryTabs'
import { CustomerGrid } from './CustomerGrid'
import { CustomerFormModal } from './forms/CustomerFormModal'
import { CustomerDetailModal } from './modals/CustomerDetailModal'
import { CustomerWithApartments } from './types'

const CustomersManagement: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [activeCategory, setActiveCategory] = useState<CustomerCategory | null>(null)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithApartments | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithApartments | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingDeleteCustomerId, setPendingDeleteCustomerId] = useState<string | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState(false)

  const {
    customers,
    counts,
    loading,
    saveCustomer,
    deleteCustomer,
    updateLastContact
  } = useCustomerData(activeCategory)

  const filteredCustomers = customers.filter(customer =>
    `${customer.name} ${customer.surname} ${customer.email} ${customer.phone}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  )

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCustomers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredCustomers.map(c => c.id)))
    }
  }

  const handleAddCustomer = () => {
    setEditingCustomer(null)
    setShowCustomerForm(true)
  }

  const handleEditCustomer = (customer: CustomerWithApartments) => {
    setEditingCustomer(customer)
    setShowCustomerForm(true)
  }

  const handleViewDetails = (customer: CustomerWithApartments) => {
    setSelectedCustomer(customer)
    setShowDetailModal(true)
  }

  const handleDeleteCustomer = (id: string) => {
    setPendingDeleteCustomerId(id)
  }

  const confirmDeleteCustomer = async () => {
    if (!pendingDeleteCustomerId) return
    setDeletingCustomer(true)
    try {
      await deleteCustomer(pendingDeleteCustomerId)
    } catch {
      toast.error('Error deleting customer')
    } finally {
      setDeletingCustomer(false)
      setPendingDeleteCustomerId(null)
    }
  }

  const handleCloseForm = () => {
    setShowCustomerForm(false)
    setEditingCustomer(null)
  }

  const handleCloseDetail = () => {
    setShowDetailModal(false)
    setSelectedCustomer(null)
  }

  const handleExportEmails = () => {
    const targets = selectedIds.size > 0
      ? filteredCustomers.filter(c => selectedIds.has(c.id))
      : filteredCustomers

    const emails = targets
      .map(c => c.email)
      .filter(email => email && email.trim() !== '')

    if (emails.length === 0) {
      toast.warning('No email addresses found for the selected customers.')
      return
    }

    const emailList = emails.join(';')
    window.location.href = `mailto:?bcc=${encodeURIComponent(emailList)}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('customers.title')}
        description={t('customers.subtitle')}
        actions={
          <>
            <Button variant="success" icon={Mail} onClick={handleExportEmails}>
              {selectedIds.size > 0
                ? `Email Selected (${selectedIds.size})`
                : `Email All (${filteredCustomers.filter(c => c.email).length})`}
            </Button>
            <Button variant="primary" icon={Plus} onClick={handleAddCustomer}>
              {t('customers.add')}
            </Button>
          </>
        }
      />

      <CategoryTabs
        activeCategory={activeCategory}
        counts={counts}
        onCategoryChange={setActiveCategory}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder={t('customers.search')}
        />
      </div>

      <CustomerGrid
        customers={filteredCustomers}
        activeCategory={activeCategory}
        loading={loading}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
        onViewDetails={handleViewDetails}
        onEdit={handleEditCustomer}
        onDelete={handleDeleteCustomer}
        onUpdateContact={updateLastContact}
      />

      <CustomerFormModal
        show={showCustomerForm}
        editingCustomer={editingCustomer}
        activeCategory={activeCategory}
        onClose={handleCloseForm}
        onSave={saveCustomer}
      />

      <CustomerDetailModal
        show={showDetailModal}
        customer={selectedCustomer}
        onClose={handleCloseDetail}
      />

      <ConfirmDialog
        show={!!pendingDeleteCustomerId}
        title={t('confirm.delete_title')}
        message={t('confirm.are_you_sure')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeleteCustomer}
        onCancel={() => setPendingDeleteCustomerId(null)}
        loading={deletingCustomer}
      />
    </div>
  )
}

export default CustomersManagement
