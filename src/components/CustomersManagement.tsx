import React, { useState } from 'react'
import { Plus, Mail } from 'lucide-react'
import { PageHeader, SearchInput, Button } from './ui'
import { CustomerCategory } from './Customers/types/customerTypes'
import { useCustomerData } from './Customers/hooks/useCustomerData'
import { CategoryTabs } from './Customers/views/CategoryTabs'
import { CustomerGrid } from './Customers/views/CustomerGrid'
import { CustomerFormModal } from './Customers/forms/CustomerFormModal'
import { CustomerDetailModal } from './Customers/forms/CustomerDetailModal'
import { CustomerWithApartments } from './Customers/types/customerTypes'

const CustomersManagement: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<CustomerCategory>('interested')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithApartments | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithApartments | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

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

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return
    try {
      await deleteCustomer(id)
    } catch (error) {
      alert('Error deleting customer')
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
    const emails = filteredCustomers
      .map(c => c.email)
      .filter(email => email && email.trim() !== '')

    if (emails.length === 0) {
      alert('No email addresses found for customers in this category.')
      return
    }

    const emailList = emails.join(';')
    window.location.href = `mailto:?bcc=${encodeURIComponent(emailList)}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Management"
        description="Manage your sales pipeline and customer relationships"
        actions={
          <>
            <Button variant="success" icon={Mail} onClick={handleExportEmails}>
              Email All ({filteredCustomers.filter(c => c.email).length})
            </Button>
            <Button variant="primary" icon={Plus} onClick={handleAddCustomer}>
              Add Customer
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
          placeholder="Search customers..."
        />
      </div>

      <CustomerGrid
        customers={filteredCustomers}
        activeCategory={activeCategory}
        loading={loading}
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
    </div>
  )
}

export default CustomersManagement
