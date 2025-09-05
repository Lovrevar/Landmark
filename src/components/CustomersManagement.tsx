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
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([])
  const [leads, setLeads] = useState<LeadWithDetails[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithDetails | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadWithDetails | null>(null)
  const [activeTab, setActiveTab] = useState<'buyers' | 'leads'>('buyers')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    address: '',
    bank_account: '',
    id_number: '',
    status: 'buyer' as const
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
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      if (projectsError) throw projectsError
      setProjects(projectsData || [])

      // For demo purposes, we'll create sample customer and lead data
      // In a real app, you'd fetch from actual customers and leads tables
      const sampleCustomers: CustomerWithDetails[] = [
        {
          id: 'customer-1',
          name: 'John',
          surname: 'Smith',
          email: 'john.smith@email.com',
          phone: '+1-555-0123',
          address: '123 Oak Street, Downtown',
          bank_account: 'XXXX-XXXX-XXXX-1234',
          id_number: 'ID123456789',
          status: 'buyer',
          created_at: '2024-01-15T10:00:00Z',
          total_purchases: 1,
          total_spent: 450000,
          last_purchase_date: '2024-01-15T10:00:00Z',
          leads: []
        },
        {
          id: 'customer-2',
          name: 'Maria',
          surname: 'Garcia',
          email: 'maria.garcia@email.com',
          phone: '+1-555-0124',
          address: '456 Pine Avenue, Midtown',
          bank_account: 'XXXX-XXXX-XXXX-5678',
          id_number: 'ID987654321',
          status: 'buyer',
          created_at: '2024-02-20T14:30:00Z',
          total_purchases: 1,
          total_spent: 510000,
          last_purchase_date: '2024-02-20T14:30:00Z',
          leads: []
        },
        {
          id: 'customer-3',
          name: 'David',
          surname: 'Johnson',
          email: 'david.johnson@email.com',
          phone: '+1-555-0125',
          address: '789 Elm Drive, Uptown',
          bank_account: 'XXXX-XXXX-XXXX-9012',
          id_number: 'ID456789123',
          status: 'interested',
          created_at: '2024-03-10T09:15:00Z',
          total_purchases: 0,
          total_spent: 0,
          last_purchase_date: null,
          leads: []
        },
        {
          id: 'customer-4',
          name: 'Sarah',
          surname: 'Wilson',
          email: 'sarah.wilson@email.com',
          phone: '+1-555-0126',
          address: '321 Maple Lane, Westside',
          bank_account: 'XXXX-XXXX-XXXX-3456',
          id_number: 'ID789123456',
          status: 'interested',
          created_at: '2024-03-25T16:45:00Z',
          total_purchases: 0,
          total_spent: 0,
          last_purchase_date: null,
          leads: []
        }
      ]

      const sampleLeads: LeadWithDetails[] = [
        {
          id: 'lead-1',
          customer_id: 'customer-3',
          project_id: projectsData?.[0]?.id || 'project-1',
          apartment_preferences: '2-3 bedrooms, high floor, city view',
          budget_range_min: 400000,
          budget_range_max: 600000,
          priority: 'high',
          status: 'negotiating',
          last_contact_date: '2024-08-28T10:00:00Z',
          next_follow_up: '2024-09-05T14:00:00Z',
          notes: 'Very interested in unit 301. Waiting for bank loan approval.',
          created_at: '2024-03-10T09:15:00Z',
          customer: sampleCustomers[2],
          project_name: projectsData?.[0]?.name || 'Sunset Towers'
        },
        {
          id: 'lead-2',
          customer_id: 'customer-4',
          project_id: projectsData?.[1]?.id || 'project-2',
          apartment_preferences: '1-2 bedrooms, lower floor, garden view',
          budget_range_min: 300000,
          budget_range_max: 450000,
          priority: 'medium',
          status: 'viewing_scheduled',
          last_contact_date: '2024-08-30T15:30:00Z',
          next_follow_up: '2024-09-06T11:00:00Z',
          notes: 'Scheduled for viewing this weekend. First-time buyer.',
          created_at: '2024-03-25T16:45:00Z',
          customer: sampleCustomers[3],
          project_name: projectsData?.[1]?.name || 'Green Valley Office Park'
        }
      ]

      setCustomers(sampleCustomers)
      setLeads(sampleLeads)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.email.trim()) return

    // In a real app, you'd insert into the database
    const customer: CustomerWithDetails = {
      id: `customer-${Date.now()}`,
      ...newCustomer,
      created_at: new Date().toISOString(),
      total_purchases: 0,
      total_spent: 0,
      last_purchase_date: null,
      leads: []
    }

    setCustomers([...customers, customer])
    setNewCustomer({
      name: '',
      surname: '',
      email: '',
      phone: '',
      address: '',
      bank_account: '',
      id_number: '',
      status: 'buyer'
    })
    setShowCustomerForm(false)
  }

  const addLead = async () => {
    if (!newLead.customer_id || !newLead.project_id) return

    const customer = customers.find(c => c.id === newLead.customer_id)
    const project = projects.find(p => p.id === newLead.project_id)
    
    if (!customer || !project) return

    const lead: LeadWithDetails = {
      id: `lead-${Date.now()}`,
      ...newLead,
      created_at: new Date().toISOString(),
      customer,
      project_name: project.name
    }

    setLeads([...leads, lead])
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
    setShowLeadForm(false)
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
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedCustomer(customer)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {customer.name} {customer.surname}
                  </h3>
                  <p className="text-sm text-gray-600">{customer.email}</p>
                </div>
                <Eye className="w-5 h-5 text-gray-400" />
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center">
                  <Phone className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">{customer.phone}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">{customer.address}</span>
                </div>
                <div className="flex items-center">
                  <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">{customer.bank_account}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">{customer.total_purchases}</p>
                    <p className="text-xs text-gray-600">Purchases</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">${customer.total_spent.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Total Spent</p>
                  </div>
                </div>
                {customer.last_purchase_date && (
                  <div className="mt-3 text-center">
                    <p className="text-xs text-gray-500">
                      Last purchase: {format(new Date(customer.last_purchase_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}
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
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedLead(lead)}
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
                <Eye className="w-5 h-5 text-gray-400" />
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
                    {format(new Date(lead.last_contact_date), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Next Follow-up</p>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(lead.next_follow_up), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs text-gray-500 mb-1">Preferences</p>
                <p className="text-sm text-gray-700">{lead.apartment_preferences}</p>
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
                <h3 className="text-xl font-semibold text-gray-900">Add New Customer</h3>
                <button
                  onClick={() => setShowCustomerForm(false)}
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
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCustomerForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={addCustomer}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Add Customer
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
                <h3 className="text-xl font-semibold text-gray-900">Add New Lead</h3>
                <button
                  onClick={() => setShowLeadForm(false)}
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
                  onClick={() => setShowLeadForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={addLead}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Add Lead
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
                      <span className="text-blue-800">{selectedCustomer.phone}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-blue-800">{selectedCustomer.email}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-blue-800">{selectedCustomer.address}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3">Financial Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <CreditCard className="w-4 h-4 text-green-600 mr-2" />
                      <span className="text-green-800">{selectedCustomer.bank_account}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">ID Number:</span>
                      <span className="font-medium text-green-900">{selectedCustomer.id_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Total Spent:</span>
                      <span className="font-bold text-green-900">${selectedCustomer.total_spent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Purchases:</span>
                      <span className="font-medium text-green-900">{selectedCustomer.total_purchases}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedCustomer.last_purchase_date && (
                <div className="mt-6 bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-3">Purchase History</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-purple-700">Last Purchase:</span>
                    <span className="font-medium text-purple-900">
                      {format(new Date(selectedCustomer.last_purchase_date), 'MMMM dd, yyyy')}
                    </span>
                  </div>
                </div>
              )}
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
                      <span className="text-blue-800">{selectedLead.customer.phone}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-blue-800">{selectedLead.customer.address}</span>
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
                        {format(new Date(selectedLead.last_contact_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Next Follow-up:</span>
                      <span className="font-medium text-green-900">
                        {format(new Date(selectedLead.next_follow_up), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-purple-900 mb-3">Apartment Preferences</h4>
                <p className="text-purple-800">{selectedLead.apartment_preferences}</p>
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