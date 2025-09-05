import React, { useState, useEffect } from 'react'
import { supabase, Customer, Lead, Project } from '../lib/supabase'
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
  Building2,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'

interface CustomerWithDetails extends Customer {
  total_purchases: number
  total_spent: number
  last_purchase_date: string | null
  leads: Lead[]
}

interface LeadWithDetails extends Lead {
  customer: Customer
  project_name: string
}

const CustomersManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [leads, setLeads] = useState<LeadWithDetails[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadWithDetails | null>(null)
  const [activeTab, setActiveTab] = useState<'buyers' | 'leads'>('buyers')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [editingLead, setEditingLead] = useState<LeadWithDetails | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    address: '',
    bank_account: '',
    id_number: '',
    status: 'interested' as const
  })
  const [newLead, setNewLead] = useState({
    customer_id: '',
    project_id: '',
    apartment_preferences: '',
    budget_range_min: 0,
    budget_range_max: 0,
    priority: 'medium' as const,
    status: 'new' as const,
    last_contact_date: '',
    next_follow_up: '',
    notes: ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (customersError) throw customersError

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      if (projectsError) throw projectsError

      // Fetch leads with customer and project details
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select(`
          *,
          customers!inner(*),
          projects!inner(name)
        `)
        .order('created_at', { ascending: false })

      if (leadsError) throw leadsError

      const leadsWithDetails = (leadsData || []).map(lead => ({
        ...lead,
        customer: lead.customers,
        project_name: lead.projects.name
      }))

      setCustomers(customersData || [])
      setProjects(projectsData || [])
      setLeads(leadsWithDetails)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.email.trim()) {
      alert('Please fill in required fields (name and email)')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert(newCustomer)
        .select()
        .single()

      if (error) throw error

      setCustomers([data, ...customers])
      resetCustomerForm()
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('Error adding customer. Please check if email or ID number already exists.')
    }
  }

  const updateCustomer = async () => {
    if (!editingCustomer || !newCustomer.name.trim() || !newCustomer.email.trim()) return

    try {
      const { data, error } = await supabase
        .from('customers')
        .update(newCustomer)
        .eq('id', editingCustomer.id)
        .select()
        .single()

      if (error) throw error

      setCustomers(customers.map(c => c.id === editingCustomer.id ? data : c))
      resetCustomerForm()
    } catch (error) {
      console.error('Error updating customer:', error)
      alert('Error updating customer.')
    }
  }

  const deleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)

      if (error) throw error

      setCustomers(customers.filter(c => c.id !== customerId))
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Error deleting customer.')
    }
  }

  const addLead = async () => {
    if (!newLead.customer_id || !newLead.project_id) {
      alert('Please select customer and project')
      return
    }

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert(newLead)
        .select(`
          *,
          customers!inner(*),
          projects!inner(name)
        `)
        .single()

      if (error) throw error

      const leadWithDetails = {
        ...data,
        customer: data.customers,
        project_name: data.projects.name
      }

      setLeads([leadWithDetails, ...leads])
      resetLeadForm()
    } catch (error) {
      console.error('Error adding lead:', error)
      alert('Error adding lead.')
    }
  }

  const updateLead = async () => {
    if (!editingLead) return

    try {
      const { data, error } = await supabase
        .from('leads')
        .update(newLead)
        .eq('id', editingLead.id)
        .select(`
          *,
          customers!inner(*),
          projects!inner(name)
        `)
        .single()

      if (error) throw error

      const updatedLead = {
        ...data,
        customer: data.customers,
        project_name: data.projects.name
      }

      setLeads(leads.map(l => l.id === editingLead.id ? updatedLead : l))
      resetLeadForm()
    } catch (error) {
      console.error('Error updating lead:', error)
      alert('Error updating lead.')
    }
  }

  const deleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)

      if (error) throw error

      setLeads(leads.filter(l => l.id !== leadId))
    } catch (error) {
      console.error('Error deleting lead:', error)
      alert('Error deleting lead.')
    }
  }

  const resetCustomerForm = () => {
    setNewCustomer({
      name: '',
      surname: '',
      email: '',
      phone: '',
      address: '',
      bank_account: '',
      id_number: '',
      status: 'interested'
    })
    setEditingCustomer(null)
    setShowCustomerForm(false)
  }

  const resetLeadForm = () => {
    setNewLead({
      customer_id: '',
      project_id: '',
      apartment_preferences: '',
      budget_range_min: 0,
      budget_range_max: 0,
      priority: 'medium',
      status: 'new',
      last_contact_date: '',
      next_follow_up: '',
      notes: ''
    })
    setEditingLead(null)
    setShowLeadForm(false)
  }

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer)
    setNewCustomer({
      name: customer.name,
      surname: customer.surname,
      email: customer.email,
      phone: customer.phone || '',
      address: customer.address || '',
      bank_account: customer.bank_account || '',
      id_number: customer.id_number || '',
      status: customer.status
    })
    setShowCustomerForm(true)
  }

  const handleEditLead = (lead: LeadWithDetails) => {
    setEditingLead(lead)
    setNewLead({
      customer_id: lead.customer_id,
      project_id: lead.project_id,
      apartment_preferences: lead.apartment_preferences || '',
      budget_range_min: lead.budget_range_min || 0,
      budget_range_max: lead.budget_range_max || 0,
      priority: lead.priority,
      status: lead.status,
      last_contact_date: lead.last_contact_date || '',
      next_follow_up: lead.next_follow_up || '',
      notes: lead.notes || ''
    })
    setShowLeadForm(true)
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredLeads = leads.filter(lead =>
    lead.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.customer.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.project_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800'
      case 'contacted': return 'bg-purple-100 text-purple-800'
      case 'viewing_scheduled': return 'bg-orange-100 text-orange-800'
      case 'negotiating': return 'bg-yellow-100 text-yellow-800'
      case 'closed': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading customers...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-2">Manage buyers and leads for your sales pipeline</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCustomerForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </button>
          <button
            onClick={() => setShowLeadForm(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('buyers')}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
              activeTab === 'buyers'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4 mr-2" />
            Buyers ({customers.filter(c => c.status === 'buyer').length})
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
              activeTab === 'leads'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Star className="w-4 h-4 mr-2" />
            Leads ({leads.length})
          </button>
        </nav>
      </div>

      {/* Buyers Tab */}
      {activeTab === 'buyers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.filter(c => c.status === 'buyer').map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {customer.name} {customer.surname}
                  </h3>
                  <p className="text-sm text-gray-600">{customer.email}</p>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setSelectedCustomer(customer)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditCustomer(customer)}
                    className="p-1 text-gray-400 hover:text-green-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteCustomer(customer.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center">
                  <Phone className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">{customer.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">{customer.address || 'N/A'}</span>
                </div>
                <div className="flex items-center">
                  <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">{customer.bank_account || 'N/A'}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  customer.status === 'buyer' ? 'bg-green-100 text-green-800' :
                  customer.status === 'interested' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {customer.status.toUpperCase()}
                </span>
                <p className="text-xs text-gray-500 mt-2">
                  Added: {format(new Date(customer.created_at), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leads Tab */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          {filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {lead.customer.name} {lead.customer.surname}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(lead.priority)}`}>
                      {lead.priority.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                      {lead.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{lead.customer.email}</p>
                  <p className="text-sm text-gray-600">Interested in: {lead.project_name}</p>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setSelectedLead(lead)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditLead(lead)}
                    className="p-1 text-gray-400 hover:text-green-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteLead(lead.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Budget Range</p>
                  <p className="text-sm font-medium text-gray-900">
                    ${lead.budget_range_min.toLocaleString()} - ${lead.budget_range_max.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Contact</p>
                  <p className="text-sm font-medium text-gray-900">
                    {lead.last_contact_date ? format(new Date(lead.last_contact_date), 'MMM dd, yyyy') : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Next Follow-up</p>
                  <p className="text-sm font-medium text-gray-900">
                    {lead.next_follow_up ? format(new Date(lead.next_follow_up), 'MMM dd, yyyy') : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs text-gray-500 mb-1">Preferences</p>
                <p className="text-sm text-gray-700">{lead.apartment_preferences || 'No specific preferences'}</p>
                {lead.notes && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{lead.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h3>
                <button
                  onClick={resetCustomerForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={newCustomer.surname}
                    onChange={(e) => setNewCustomer({ ...newCustomer, surname: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank Account</label>
                  <input
                    type="text"
                    value={newCustomer.bank_account}
                    onChange={(e) => setNewCustomer({ ...newCustomer, bank_account: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ID Number</label>
                  <input
                    type="text"
                    value={newCustomer.id_number}
                    onChange={(e) => setNewCustomer({ ...newCustomer, id_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={newCustomer.status}
                    onChange={(e) => setNewCustomer({ ...newCustomer, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="lead">Lead</option>
                    <option value="interested">Interested</option>
                    <option value="buyer">Buyer</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={resetCustomerForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingCustomer ? updateCustomer : addCustomer}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {editingCustomer ? 'Update' : 'Add'} Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Form Modal */}
      {showLeadForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingLead ? 'Edit Lead' : 'Add New Lead'}
                </h3>
                <button
                  onClick={resetLeadForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer *</label>
                  <select
                    value={newLead.customer_id}
                    onChange={(e) => setNewLead({ ...newLead, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.surname}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project *</label>
                  <select
                    value={newLead.project_id}
                    onChange={(e) => setNewLead({ ...newLead, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select project</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Budget</label>
                  <input
                    type="number"
                    value={newLead.budget_range_min}
                    onChange={(e) => setNewLead({ ...newLead, budget_range_min: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Budget</label>
                  <input
                    type="number"
                    value={newLead.budget_range_max}
                    onChange={(e) => setNewLead({ ...newLead, budget_range_max: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={newLead.priority}
                    onChange={(e) => setNewLead({ ...newLead, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={newLead.status}
                    onChange={(e) => setNewLead({ ...newLead, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="viewing_scheduled">Viewing Scheduled</option>
                    <option value="negotiating">Negotiating</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Contact</label>
                  <input
                    type="date"
                    value={newLead.last_contact_date}
                    onChange={(e) => setNewLead({ ...newLead, last_contact_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Next Follow-up</label>
                  <input
                    type="date"
                    value={newLead.next_follow_up}
                    onChange={(e) => setNewLead({ ...newLead, next_follow_up: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Apartment Preferences</label>
                  <textarea
                    value={newLead.apartment_preferences}
                    onChange={(e) => setNewLead({ ...newLead, apartment_preferences: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 2-3 bedrooms, high floor, city view"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={newLead.notes}
                    onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={resetLeadForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingLead ? updateLead : addLead}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  {editingLead ? 'Update' : 'Add'} Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedCustomer.name} {selectedCustomer.surname}
                  </h3>
                  <p className="text-gray-600 mt-1">{selectedCustomer.email}</p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Contact Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-blue-800">{selectedCustomer.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-blue-800">{selectedCustomer.email}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-blue-800">{selectedCustomer.address || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3">Financial Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <CreditCard className="w-4 h-4 text-green-600 mr-2" />
                      <span className="text-green-800">{selectedCustomer.bank_account || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">ID Number:</span>
                      <span className="font-medium text-green-900">{selectedCustomer.id_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Status:</span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedCustomer.status === 'buyer' ? 'bg-green-100 text-green-800' :
                        selectedCustomer.status === 'interested' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedCustomer.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Added:</span>
                      <span className="font-medium text-green-900">
                        {format(new Date(selectedCustomer.created_at), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedLead.customer.name} {selectedLead.customer.surname}
                  </h3>
                  <p className="text-gray-600 mt-1">Lead for {selectedLead.project_name}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(selectedLead.priority)}`}>
                      {selectedLead.priority.toUpperCase()} PRIORITY
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedLead.status)}`}>
                      {selectedLead.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Customer Details</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-blue-800">{selectedLead.customer.email}</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-blue-800">{selectedLead.customer.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-blue-800">{selectedLead.customer.address || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3">Budget & Timeline</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-green-700">Budget Range:</span>
                      <span className="font-medium text-green-900">
                        ${selectedLead.budget_range_min.toLocaleString()} - ${selectedLead.budget_range_max.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Last Contact:</span>
                      <span className="font-medium text-green-900">
                        {selectedLead.last_contact_date ? format(new Date(selectedLead.last_contact_date), 'MMM dd, yyyy') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Next Follow-up:</span>
                      <span className="font-medium text-green-900">
                        {selectedLead.next_follow_up ? format(new Date(selectedLead.next_follow_up), 'MMM dd, yyyy') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-purple-900 mb-3">Apartment Preferences</h4>
                <p className="text-purple-800">{selectedLead.apartment_preferences || 'No specific preferences'}</p>
              </div>

              {selectedLead.notes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Notes</h4>
                  <p className="text-gray-700">{selectedLead.notes}</p>
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