import React, { useState } from 'react'
import { Plus, Search } from 'lucide-react'
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-1">Manage your sales pipeline and customer relationships</p>
        </div>
        <button
          onClick={handleAddCustomer}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Customer
        </button>
      </div>

      <CategoryTabs
        activeCategory={activeCategory}
        counts={counts}
        onCategoryChange={setActiveCategory}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
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
