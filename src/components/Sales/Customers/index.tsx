import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Mail } from 'lucide-react'
import { PageHeader, SearchInput, Button, ConfirmDialog, Select, Alert } from '../../ui'
import { CustomerCategory } from './types'
import { useCustomerData } from './hooks/useCustomerData'
import { useToast } from '../../../contexts/ToastContext'
import { toErrorMessage } from '../../../lib/errorMessage'
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
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingDeleteCustomerId, setPendingDeleteCustomerId] = useState<string | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState(false)

  const {
    customers,
    counts,
    projects,
    loading,
    error,
    refetch,
    dismissError,
    saveCustomer,
    deleteCustomer,
    updateLastContact
  } = useCustomerData(activeCategory)

  // Nothing came back and the request failed: the grid must say so rather than render its
  // "no customers" empty state.
  const loadFailed = !!error && customers.length === 0

  // A customer's project comes from two places: interested/lead customers carry
  // `interested_project_id`, while buyers are linked through the apartments they
  // bought. Matching only the former would make the filter return nothing for
  // buyers, so both are checked.
  const matchesProject = (customer: CustomerWithApartments) => {
    if (!projectFilter) return true
    if (customer.interested_project_id === projectFilter) return true
    return (customer.apartments ?? []).some(unit => unit.project_id === projectFilter)
  }

  const filteredCustomers = customers.filter(customer =>
    `${customer.name} ${customer.surname} ${customer.email ?? ''} ${customer.phone ?? ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    && matchesProject(customer)
  )

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  // Only customers on screen count as selected. `selectedIds` can still hold the id of a
  // customer that has since been deleted, so its size is not a reliable count.
  const selectedCustomers = filteredCustomers.filter(c => selectedIds.has(c.id))

  const handleSelectAll = () => {
    if (filteredCustomers.length > 0 && selectedCustomers.length === filteredCustomers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredCustomers.map(c => c.id)))
    }
  }

  // A filter change drops the selection, so the email export can never reach customers the
  // user can no longer see.
  const clearSelection = () => setSelectedIds(new Set())

  const handleCategoryChange = (category: CustomerCategory | null) => {
    setActiveCategory(category)
    clearSelection()
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    clearSelection()
  }

  const handleProjectFilterChange = (projectId: string) => {
    setProjectFilter(projectId)
    clearSelection()
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
      setPendingDeleteCustomerId(null)
    } catch (err) {
      // The dialog stays open on failure, so the user can see what it refers to and retry.
      toast.error(toErrorMessage(err, t('customers.errors.delete_failed')))
    } finally {
      setDeletingCustomer(false)
    }
  }

  // `updateLastContact` rejects (the hook rethrows); the card's button used to drop that
  // promise on the floor, leaving an unhandled rejection and a date that never moved.
  const handleUpdateContact = async (id: string) => {
    try {
      await updateLastContact(id)
    } catch (err) {
      toast.error(toErrorMessage(err, t('customers.errors.update_contact_failed')))
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
    const targets = selectedCustomers.length > 0 ? selectedCustomers : filteredCustomers

    const emails = targets
      .map(c => c.email)
      .filter(email => email && email.trim() !== '')

    if (emails.length === 0) {
      toast.warning(t('customers.no_emails'))
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
              {selectedCustomers.length > 0
                ? t('customers.email_selected', { count: selectedCustomers.length })
                : t('customers.email_all', { count: filteredCustomers.filter(c => c.email).length })}
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
        countsUnknown={loadFailed}
        onCategoryChange={handleCategoryChange}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              onClear={() => handleSearchChange('')}
              placeholder={t('customers.search')}
            />
          </div>
          <div className="w-full sm:w-64">
            <Select
              value={projectFilter}
              onChange={(e) => handleProjectFilterChange(e.target.value)}
            >
              <option value="">{t('common.all_projects')}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {error && !loadFailed && (
        <Alert variant="error" title={t('common.load_error_title')} onDismiss={dismissError}>
          {t('common.load_error_description')}{' '}
          <button type="button" onClick={() => { void refetch() }} className="underline font-medium">
            {t('common.retry')}
          </button>
        </Alert>
      )}

      <CustomerGrid
        customers={filteredCustomers}
        projects={projects}
        activeCategory={activeCategory}
        loading={loading && customers.length === 0}
        loadFailed={loadFailed}
        onRetry={() => { void refetch() }}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
        onViewDetails={handleViewDetails}
        onEdit={handleEditCustomer}
        onDelete={handleDeleteCustomer}
        onUpdateContact={(id) => { void handleUpdateContact(id) }}
      />

      <CustomerFormModal
        show={showCustomerForm}
        editingCustomer={editingCustomer}
        activeCategory={activeCategory}
        projects={projects}
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
