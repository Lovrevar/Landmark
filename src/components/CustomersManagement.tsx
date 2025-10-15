import React, { useState, useEffect } from 'react'
import { supabase, Customer, Sale, Apartment } from '../lib/supabase'
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Calendar,
  Star,
  Eye,
  Edit2,
  Trash2,
  X,
  Home,
  DollarSign,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  UserX,
  Flame,
  MessageSquare
} from 'lucide-react'
import { format } from 'date-fns'

interface CustomerWithApartments extends Customer {
  apartments?: Array<{
    id: string
    number: string
    floor: number
    size_m2: number
    project_name: string
    sale_price: number
    sale_date: string
  }>
}

type CustomerCategory = 'interested' | 'hot_lead' | 'negotiating' | 'buyer' | 'backed_out'

const CustomersManagement: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerWithApartments[]>([])
  const [activeCategory, setActiveCategory] = useState<CustomerCategory>('interested')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithApartments | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithApartments | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    surname: '',
    email: '',
    phone: '',
    address: '',
    bank_account: '',
    id_number: '',
    status: 'interested',
    priority: 'warm',
    notes: '',
    preferences: {
      budget_min: 0,
      budget_max: 0,
      preferred_size_min: 0,
      preferred_size_max: 0,
      preferred_floor: '',
      preferred_location: '',
      bedrooms: 0,
      notes: ''
    }
  })

  useEffect(() => {
    fetchCustomers()
  }, [activeCategory])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const { data: customersData, error } = await supabase
        .from('customers')
        .select('*')
        .eq('status', activeCategory)
        .order('last_contact_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      const customersWithDetails = await Promise.all(
        (customersData || []).map(async (customer) => {
          if (customer.status === 'buyer') {
            const { data: salesData } = await supabase
              .from('sales')
              .select('apartment_id, sale_price, sale_date')
              .eq('customer_id', customer.id)

            if (salesData && salesData.length > 0) {
              const apartments = await Promise.all(
                salesData.map(async (sale) => {
                  const { data: aptData } = await supabase
                    .from('apartments')
                    .select('id, number, floor, size_m2, project_id')
                    .eq('id', sale.apartment_id)
                    .maybeSingle()

                  if (aptData) {
                    const { data: projData } = await supabase
                      .from('projects')
                      .select('name')
                      .eq('id', aptData.project_id)
                      .maybeSingle()

                    return {
                      id: aptData.id,
                      number: aptData.number,
                      floor: aptData.floor,
                      size_m2: aptData.size_m2,
                      project_name: projData?.name || 'Unknown',
                      sale_price: sale.sale_price,
                      sale_date: sale.sale_date
                    }
                  }
                  return null
                })
              )

              return {
                ...customer,
                apartments: apartments.filter(apt => apt !== null) as any[]
              }
            }
          }

          return customer
        })
      )

      setCustomers(customersWithDetails)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCustomer = async () => {
    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(formData)
          .eq('id', editingCustomer.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([formData])

        if (error) throw error
      }

      setShowCustomerForm(false)
      setEditingCustomer(null)
      resetForm()
      fetchCustomers()
    } catch (error) {
      console.error('Error saving customer:', error)
      alert('Error saving customer')
    }
  }

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Error deleting customer')
    }
  }

  const handleUpdateLastContact = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ last_contact_date: new Date().toISOString() })
        .eq('id', customerId)

      if (error) throw error
      fetchCustomers()
    } catch (error) {
      console.error('Error updating contact date:', error)
    }
  }

  const openEditForm = (customer: CustomerWithApartments) => {
    setEditingCustomer(customer)
    setFormData(customer)
    setShowCustomerForm(true)
  }

  const openDetailModal = (customer: CustomerWithApartments) => {
    setSelectedCustomer(customer)
    setShowDetailModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      surname: '',
      email: '',
      phone: '',
      address: '',
      bank_account: '',
      id_number: '',
      status: activeCategory,
      priority: 'warm',
      notes: '',
      preferences: {
        budget_min: 0,
        budget_max: 0,
        preferred_size_min: 0,
        preferred_size_max: 0,
        preferred_floor: '',
        preferred_location: '',
        bedrooms: 0,
        notes: ''
      }
    })
  }

  const filteredCustomers = customers.filter(customer =>
    `${customer.name} ${customer.surname} ${customer.email} ${customer.phone}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  )

  const categories = [
    { id: 'interested' as CustomerCategory, label: 'Interested', icon: Users, color: 'blue', count: 0 },
    { id: 'hot_lead' as CustomerCategory, label: 'Hot Leads', icon: Flame, color: 'red', count: 0 },
    { id: 'negotiating' as CustomerCategory, label: 'Negotiating', icon: MessageSquare, color: 'yellow', count: 0 },
    { id: 'buyer' as CustomerCategory, label: 'Buyers', icon: CheckCircle, color: 'green', count: 0 },
    { id: 'backed_out' as CustomerCategory, label: 'Backed Out', icon: UserX, color: 'gray', count: 0 }
  ]

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'hot': return 'text-red-600 bg-red-100'
      case 'warm': return 'text-yellow-600 bg-yellow-100'
      case 'cold': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'hot': return <Flame className="w-4 h-4" />
      case 'warm': return <TrendingUp className="w-4 h-4" />
      case 'cold': return <AlertCircle className="w-4 h-4" />
      default: return <Star className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-1">Manage your sales pipeline and customer relationships</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setEditingCustomer(null)
            setShowCustomerForm(true)
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Customer
        </button>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2">
        {categories.map((category) => {
          const Icon = category.icon
          const isActive = activeCategory === category.id
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                isActive
                  ? `bg-${category.color}-600 text-white shadow-md`
                  : `bg-white text-gray-700 hover:bg-${category.color}-50 border border-gray-200`
              }`}
            >
              <Icon className="w-5 h-5 mr-2" />
              {category.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                isActive ? 'bg-white bg-opacity-30' : `bg-${category.color}-100 text-${category.color}-700`
              }`}>
                {filteredCustomers.length}
              </span>
            </button>
          )
        })}
      </div>

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

      {loading ? (
        <div className="text-center py-12">Loading customers...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No customers in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {customer.name} {customer.surname}
                  </h3>
                  {customer.priority && (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${getPriorityColor(customer.priority)}`}>
                      {getPriorityIcon(customer.priority)}
                      <span className="ml-1 capitalize">{customer.priority}</span>
                    </span>
                  )}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => openDetailModal(customer)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditForm(customer)}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCustomer(customer.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-4 h-4 mr-2" />
                  {customer.email}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2" />
                  {customer.phone}
                </div>
                {customer.last_contact_date && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2" />
                    Last contact: {format(new Date(customer.last_contact_date), 'MMM dd, yyyy')}
                  </div>
                )}
              </div>

              {activeCategory === 'buyer' && customer.apartments && customer.apartments.length > 0 && (
                <div className="mb-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-xs font-semibold text-green-800 mb-2">Purchased Units</p>
                  {customer.apartments.map((apt) => (
                    <div key={apt.id} className="text-xs text-green-700 flex justify-between">
                      <span>{apt.project_name} - Unit {apt.number}</span>
                      <span>€{(apt.sale_price / 1000).toFixed(0)}K</span>
                    </div>
                  ))}
                </div>
              )}

              {(activeCategory === 'interested' || activeCategory === 'hot_lead') && customer.preferences && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-semibold text-blue-800 mb-2">Preferences</p>
                  <div className="text-xs text-blue-700 space-y-1">
                    {customer.preferences.budget_min && customer.preferences.budget_max && (
                      <div>Budget: €{(customer.preferences.budget_min / 1000).toFixed(0)}K - €{(customer.preferences.budget_max / 1000).toFixed(0)}K</div>
                    )}
                    {customer.preferences.preferred_size_min && customer.preferences.preferred_size_max && (
                      <div>Size: {customer.preferences.preferred_size_min}m² - {customer.preferences.preferred_size_max}m²</div>
                    )}
                    {customer.preferences.bedrooms && (
                      <div>Bedrooms: {customer.preferences.bedrooms}</div>
                    )}
                    {customer.preferences.preferred_location && (
                      <div>Location: {customer.preferences.preferred_location}</div>
                    )}
                  </div>
                </div>
              )}

              {activeCategory === 'backed_out' && customer.backed_out_reason && (
                <div className="mb-4 p-3 bg-red-50 rounded-lg">
                  <p className="text-xs font-semibold text-red-800 mb-1">Backed Out Reason</p>
                  <p className="text-xs text-red-700">{customer.backed_out_reason}</p>
                </div>
              )}

              <button
                onClick={() => handleUpdateLastContact(customer.id)}
                className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Update Contact Date
              </button>
            </div>
          ))}
        </div>
      )}

      {showCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button
                onClick={() => {
                  setShowCustomerForm(false)
                  setEditingCustomer(null)
                  resetForm()
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="interested">Interested</option>
                    <option value="hot_lead">Hot Lead</option>
                    <option value="negotiating">Negotiating</option>
                    <option value="buyer">Buyer</option>
                    <option value="backed_out">Backed Out</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="cold">Cold</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank Account</label>
                  <input
                    type="text"
                    value={formData.bank_account}
                    onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ID Number</label>
                  <input
                    type="text"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {formData.status === 'backed_out' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Backed Out Reason</label>
                  <textarea
                    value={formData.backed_out_reason}
                    onChange={(e) => setFormData({ ...formData, backed_out_reason: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Why did this customer back out?"
                  />
                </div>
              )}

              {(formData.status === 'interested' || formData.status === 'hot_lead' || formData.status === 'negotiating') && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Preferences</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Min Budget (€)</label>
                      <input
                        type="number"
                        value={formData.preferences?.budget_min || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          preferences: { ...formData.preferences, budget_min: Number(e.target.value) }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Budget (€)</label>
                      <input
                        type="number"
                        value={formData.preferences?.budget_max || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          preferences: { ...formData.preferences, budget_max: Number(e.target.value) }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Min Size (m²)</label>
                      <input
                        type="number"
                        value={formData.preferences?.preferred_size_min || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          preferences: { ...formData.preferences, preferred_size_min: Number(e.target.value) }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Size (m²)</label>
                      <input
                        type="number"
                        value={formData.preferences?.preferred_size_max || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          preferences: { ...formData.preferences, preferred_size_max: Number(e.target.value) }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Bedrooms</label>
                      <input
                        type="number"
                        value={formData.preferences?.bedrooms || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          preferences: { ...formData.preferences, bedrooms: Number(e.target.value) }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Floor</label>
                      <input
                        type="text"
                        value={formData.preferences?.preferred_floor || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          preferences: { ...formData.preferences, preferred_floor: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Ground, 1-3"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Location</label>
                    <input
                      type="text"
                      value={formData.preferences?.preferred_location || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, preferred_location: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preference Notes</label>
                    <textarea
                      value={formData.preferences?.notes || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, notes: e.target.value }
                      })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Additional notes about customer preferences"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">General Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any additional notes about this customer"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCustomerForm(false)
                  setEditingCustomer(null)
                  resetForm()
                }}
                className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomer}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingCustomer ? 'Update Customer' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCustomer.name} {selectedCustomer.surname}
              </h2>
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedCustomer(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start">
                  <Mail className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-gray-900">{selectedCustomer.email}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Phone className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium text-gray-900">{selectedCustomer.phone}</p>
                  </div>
                </div>
              </div>

              {selectedCustomer.address && (
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Address</p>
                    <p className="font-medium text-gray-900">{selectedCustomer.address}</p>
                  </div>
                </div>
              )}

              {selectedCustomer.last_contact_date && (
                <div className="flex items-start">
                  <Clock className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Last Contact</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date(selectedCustomer.last_contact_date), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              )}

              {selectedCustomer.status === 'buyer' && selectedCustomer.apartments && selectedCustomer.apartments.length > 0 && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Home className="w-5 h-5 mr-2" />
                    Purchased Apartments
                  </h3>
                  <div className="space-y-3">
                    {selectedCustomer.apartments.map((apt) => (
                      <div key={apt.id} className="bg-green-50 p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{apt.project_name}</p>
                            <p className="text-sm text-gray-600">Unit {apt.number} - Floor {apt.floor}</p>
                            <p className="text-sm text-gray-600">{apt.size_m2}m²</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-700">€{apt.sale_price.toLocaleString()}</p>
                            <p className="text-xs text-gray-600">{format(new Date(apt.sale_date), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(selectedCustomer.status === 'interested' || selectedCustomer.status === 'hot_lead' || selectedCustomer.status === 'negotiating') && selectedCustomer.preferences && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedCustomer.preferences.budget_min && selectedCustomer.preferences.budget_max && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Budget Range</p>
                        <p className="font-medium text-gray-900">
                          €{(selectedCustomer.preferences.budget_min / 1000).toFixed(0)}K - €{(selectedCustomer.preferences.budget_max / 1000).toFixed(0)}K
                        </p>
                      </div>
                    )}
                    {selectedCustomer.preferences.preferred_size_min && selectedCustomer.preferences.preferred_size_max && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Size Range</p>
                        <p className="font-medium text-gray-900">
                          {selectedCustomer.preferences.preferred_size_min}m² - {selectedCustomer.preferences.preferred_size_max}m²
                        </p>
                      </div>
                    )}
                    {selectedCustomer.preferences.bedrooms && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Bedrooms</p>
                        <p className="font-medium text-gray-900">{selectedCustomer.preferences.bedrooms}</p>
                      </div>
                    )}
                    {selectedCustomer.preferences.preferred_floor && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Preferred Floor</p>
                        <p className="font-medium text-gray-900">{selectedCustomer.preferences.preferred_floor}</p>
                      </div>
                    )}
                  </div>
                  {selectedCustomer.preferences.preferred_location && (
                    <div className="bg-blue-50 p-3 rounded-lg mt-3">
                      <p className="text-sm text-gray-600">Preferred Location</p>
                      <p className="font-medium text-gray-900">{selectedCustomer.preferences.preferred_location}</p>
                    </div>
                  )}
                  {selectedCustomer.preferences.notes && (
                    <div className="bg-blue-50 p-3 rounded-lg mt-3">
                      <p className="text-sm text-gray-600">Preference Notes</p>
                      <p className="font-medium text-gray-900">{selectedCustomer.preferences.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedCustomer.status === 'backed_out' && selectedCustomer.backed_out_reason && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Backed Out Reason</h3>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-gray-900">{selectedCustomer.backed_out_reason}</p>
                  </div>
                </div>
              )}

              {selectedCustomer.notes && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedCustomer.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomersManagement
