import React, { useState, useEffect } from 'react'
import { supabase, Project, Apartment, Customer, Sale } from '../lib/supabase'
import { 
  Building2, 
  Home, 
  DollarSign, 
  Users, 
  Calendar,
  Eye,
  Edit2,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  X,
  CreditCard,
  Banknote,
  PiggyBank,
  UserPlus
} from 'lucide-react'
import { format } from 'date-fns'

interface ApartmentWithDetails extends Apartment {
  project_name: string
  customer?: Customer
  sale?: Sale
}

interface ProjectWithApartments extends Project {
  apartments: ApartmentWithDetails[]
  total_apartments: number
  sold_apartments: number
  available_apartments: number
  reserved_apartments: number
  total_revenue: number
  average_price: number
}

const SalesProjects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWithApartments[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithApartments | null>(null)
  const [selectedApartment, setSelectedApartment] = useState<ApartmentWithDetails | null>(null)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [saleData, setSaleData] = useState({
    payment_method: 'bank_loan' as const,
    down_payment: 0,
    monthly_payment: 0,
    next_payment_date: '',
    contract_signed: false,
    notes: ''
  })
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
        .order('created_at', { ascending: false })

      if (projectsError) throw projectsError

      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (customersError) throw customersError

      // Fetch apartments with sales data
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select(`
          *,
          projects!inner(name),
          sales(
            *,
            customers(*)
          )
        `)
        .order('project_id')
        .order('floor')
        .order('number')

      if (apartmentsError) throw apartmentsError

      // Process apartments with details
      const apartmentsWithDetails = (apartmentsData || []).map(apt => ({
        ...apt,
        project_name: apt.projects.name,
        customer: apt.sales?.[0]?.customers || undefined,
        sale: apt.sales?.[0] || undefined
      }))

      // Group apartments by project and calculate stats
      const projectsWithApartments = (projectsData || []).map(project => {
        const projectApartments = apartmentsWithDetails.filter(apt => apt.project_id === project.id)
        
        const total_apartments = projectApartments.length
        const sold_apartments = projectApartments.filter(apt => apt.status === 'Sold').length
        const available_apartments = projectApartments.filter(apt => apt.status === 'Available').length
        const reserved_apartments = projectApartments.filter(apt => apt.status === 'Reserved').length
        const total_revenue = projectApartments
          .filter(apt => apt.sale)
          .reduce((sum, apt) => sum + (apt.sale?.sale_price || 0), 0)
        const average_price = total_apartments > 0 
          ? projectApartments.reduce((sum, apt) => sum + apt.price, 0) / total_apartments 
          : 0

        return {
          ...project,
          apartments: projectApartments,
          total_apartments,
          sold_apartments,
          available_apartments,
          reserved_apartments,
          total_revenue,
          average_price
        }
      })

      setProjects(projectsWithApartments)
      setCustomers(customersData || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSellApartment = async () => {
    if (!selectedApartment || !selectedCustomerId) return

    try {
      const customer = customers.find(c => c.id === selectedCustomerId)
      if (!customer) return

      // Calculate remaining amount
      const remaining_amount = selectedApartment.price - saleData.down_payment

      // Create sale record
      const { data: saleRecord, error: saleError } = await supabase
        .from('sales')
        .insert({
          apartment_id: selectedApartment.id,
          customer_id: selectedCustomerId,
          sale_price: selectedApartment.price,
          payment_method: saleData.payment_method,
          down_payment: saleData.down_payment,
          total_paid: saleData.down_payment,
          remaining_amount: remaining_amount,
          next_payment_date: saleData.next_payment_date || null,
          monthly_payment: saleData.monthly_payment,
          sale_date: new Date().toISOString().split('T')[0],
          contract_signed: saleData.contract_signed,
          notes: saleData.notes
        })
        .select()
        .single()

      if (saleError) throw saleError

      // Update apartment status and buyer
      const { error: apartmentError } = await supabase
        .from('apartments')
        .update({ 
          status: 'Sold',
          buyer_name: `${customer.name} ${customer.surname}`
        })
        .eq('id', selectedApartment.id)

      if (apartmentError) throw apartmentError

      // Update customer status to buyer
      const { error: customerError } = await supabase
        .from('customers')
        .update({ status: 'buyer' })
        .eq('id', selectedCustomerId)

      if (customerError) throw customerError

      // Reset form and refresh data
      setShowSaleModal(false)
      setSelectedApartment(null)
      setSelectedCustomerId('')
      setSaleData({
        payment_method: 'bank_loan',
        down_payment: 0,
        monthly_payment: 0,
        next_payment_date: '',
        contract_signed: false,
        notes: ''
      })
      
      // Update the selected project's apartments immediately
      if (selectedProject) {
        const updatedApartments = selectedProject.apartments.map(apt => 
          apt.id === selectedApartment.id 
            ? { ...apt, status: 'Sold' as const, buyer_name: `${customer.name} ${customer.surname}` }
            : apt
        )
        
        const soldCount = updatedApartments.filter(apt => apt.status === 'Sold').length
        const availableCount = updatedApartments.filter(apt => apt.status === 'Available').length
        
        setSelectedProject({
          ...selectedProject,
          apartments: updatedApartments,
          sold_apartments: soldCount,
          available_apartments: availableCount,
          total_revenue: updatedApartments
            .filter(apt => apt.status === 'Sold')
            .reduce((sum, apt) => sum + apt.price, 0)
        })
      }
      
      await fetchData()
    } catch (error) {
      console.error('Error creating sale:', error)
      alert('Error processing sale. Please try again.')
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

      // Refresh customers list and select the new customer
      await fetchData()
      setSelectedCustomerId(data.id)
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
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('Error adding customer. Please check if email or ID number already exists.')
    }
  }

  const updateApartmentStatus = async (apartmentId: string, newStatus: string) => {
    if (newStatus === 'Sold') {
      // Open sale modal instead of direct update
      const apartment = projects
        .flatMap(p => p.apartments)
        .find(apt => apt.id === apartmentId)
      
      if (apartment) {
        setSelectedApartment(apartment)
        setShowSaleModal(true)
        // Set default down payment to 20%
        setSaleData(prev => ({
          ...prev,
          down_payment: apartment.price * 0.2
        }))
      }
      return
    }

    try {
      const updateData: any = { status: newStatus }
      if (newStatus === 'Available') {
        updateData.buyer_name = null
      }

      const { error } = await supabase
        .from('apartments')
        .update(updateData)
        .eq('id', apartmentId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error updating apartment:', error)
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4" />
      case 'credit': return <CreditCard className="w-4 h-4" />
      case 'bank_loan': return <Building2 className="w-4 h-4" />
      case 'installments': return <Calendar className="w-4 h-4" />
      default: return <DollarSign className="w-4 h-4" />
    }
  }

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'cash': return 'text-green-600 bg-green-100'
      case 'credit': return 'text-blue-600 bg-blue-100'
      case 'bank_loan': return 'text-purple-600 bg-purple-100'
      case 'installments': return 'text-orange-600 bg-orange-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading sales projects...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Sales Projects</h1>
        <p className="text-gray-600 mt-2">Manage apartment sales and customer relationships</p>
      </div>

      {/* Projects Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {projects.map((project) => {
          const salesRate = project.total_apartments > 0 
            ? (project.sold_apartments / project.total_apartments) * 100 
            : 0

          return (
            <div
              key={project.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedProject(project)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{project.location}</p>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {project.status}
                  </span>
                </div>
                <Eye className="w-5 h-5 text-gray-400" />
              </div>

              {/* Sales Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{project.sold_apartments}</p>
                  <p className="text-xs text-gray-600">Sold</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{project.available_apartments}</p>
                  <p className="text-xs text-gray-600">Available</p>
                </div>
              </div>

              {/* Sales Rate */}
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Sales Rate</span>
                  <span className="text-sm font-medium">{salesRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${salesRate}%` }}
                  ></div>
                </div>
              </div>

              {/* Revenue */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Revenue</span>
                  <span className="text-lg font-bold text-green-600">
                    ${project.total_revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">Avg. Price</span>
                  <span className="text-sm font-medium text-gray-900">
                    ${project.average_price.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Project Details Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">{selectedProject.name}</h3>
                  <p className="text-gray-600 mt-1">{selectedProject.location}</p>
                  <div className="flex items-center space-x-4 mt-3">
                    <div className="flex items-center space-x-2">
                      <Home className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-600">{selectedProject.total_apartments} units</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-600">{selectedProject.sold_apartments} sold</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-gray-600">${selectedProject.total_revenue.toLocaleString()} revenue</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Apartments Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedProject.apartments.map((apartment) => (
                  <div
                    key={apartment.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                      apartment.status === 'Sold' ? 'border-green-200 bg-green-50' :
                      apartment.status === 'Reserved' ? 'border-yellow-200 bg-yellow-50' :
                      'border-blue-200 bg-blue-50'
                    }`}
                    onClick={() => setSelectedApartment(apartment)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">Unit {apartment.number}</h4>
                        <p className="text-sm text-gray-600">Floor {apartment.floor}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        apartment.status === 'Sold' ? 'bg-green-100 text-green-800' :
                        apartment.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {apartment.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Size:</span>
                        <span className="text-sm font-medium">{apartment.size_m2} m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Price:</span>
                        <span className="text-sm font-bold text-green-600">${apartment.price.toLocaleString()}</span>
                      </div>
                      {apartment.customer && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Buyer:</span>
                          <span className="text-sm font-medium">{apartment.customer.name} {apartment.customer.surname}</span>
                        </div>
                      )}
                    </div>

                    {apartment.sale && (
                      <div className="border-t pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-1">
                            {getPaymentMethodIcon(apartment.sale.payment_method)}
                            <span className="text-xs text-gray-600 capitalize">
                              {apartment.sale.payment_method.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-gray-900">
                            ${apartment.sale.total_paid.toLocaleString()} paid
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-green-600 h-1.5 rounded-full"
                            style={{ width: `${(apartment.sale.total_paid / apartment.sale.sale_price) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {apartment.status !== 'Sold' && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedApartment(apartment)
                            setShowSaleModal(true)
                            setSaleData(prev => ({
                              ...prev,
                              down_payment: apartment.price * 0.2
                            }))
                          }}
                          className="w-full px-3 py-1 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors duration-200"
                        >
                          Mark as Sold
                        </button>
                        {apartment.status === 'Available' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateApartmentStatus(apartment.id, 'Reserved')
                            }}
                            className="w-full px-3 py-1 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 transition-colors duration-200"
                          >
                            Reserve
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {showSaleModal && selectedApartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Sell Unit {selectedApartment.number}
                  </h3>
                  <p className="text-gray-600 mt-1">
                    {selectedApartment.project_name} • ${selectedApartment.price.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowSaleModal(false)
                    setSelectedApartment(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Customer Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Customer *
                </label>
                <div className="flex space-x-3">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Choose existing customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.surname} - {customer.email}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowCustomerForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    New Customer
                  </button>
                </div>
              </div>

              {/* Sale Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={saleData.payment_method}
                    onChange={(e) => setSaleData({ ...saleData, payment_method: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="cash">Cash</option>
                    <option value="credit">Credit</option>
                    <option value="bank_loan">Bank Loan</option>
                    <option value="installments">Installments</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Down Payment ($)
                  </label>
                  <input
                    type="number"
                    value={saleData.down_payment}
                    onChange={(e) => setSaleData({ ...saleData, down_payment: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {saleData.payment_method === 'installments' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Monthly Payment ($)
                      </label>
                      <input
                        type="number"
                        value={saleData.monthly_payment}
                        onChange={(e) => setSaleData({ ...saleData, monthly_payment: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Next Payment Date
                      </label>
                      <input
                        type="date"
                        value={saleData.next_payment_date}
                        onChange={(e) => setSaleData({ ...saleData, next_payment_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={saleData.contract_signed}
                      onChange={(e) => setSaleData({ ...saleData, contract_signed: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Contract signed</span>
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={saleData.notes}
                    onChange={(e) => setSaleData({ ...saleData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes about the sale..."
                  />
                </div>
              </div>

              {/* Sale Summary */}
              <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Sale Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Sale Price:</p>
                    <p className="font-bold text-lg">${selectedApartment.price.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Down Payment:</p>
                    <p className="font-bold text-lg text-green-600">${saleData.down_payment.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Remaining Amount:</p>
                    <p className="font-bold text-lg text-orange-600">
                      ${(selectedApartment.price - saleData.down_payment).toLocaleString()}
                    </p>
                  </div>
                  {saleData.payment_method === 'installments' && (
                    <div>
                      <p className="text-sm text-gray-600">Monthly Payment:</p>
                      <p className="font-bold text-lg text-blue-600">${saleData.monthly_payment.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowSaleModal(false)
                    setSelectedApartment(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSellApartment}
                  disabled={!selectedCustomerId}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Complete Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
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

      {/* Apartment Details Modal */}
      {selectedApartment && !showSaleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Unit {selectedApartment.number} - {selectedApartment.project_name}
                  </h3>
                  <p className="text-gray-600 mt-1">Floor {selectedApartment.floor} • {selectedApartment.size_m2} m²</p>
                </div>
                <button
                  onClick={() => setSelectedApartment(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Apartment Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Apartment Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Unit Number:</span>
                      <span className="font-medium text-blue-900">{selectedApartment.number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Floor:</span>
                      <span className="font-medium text-blue-900">{selectedApartment.floor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Size:</span>
                      <span className="font-medium text-blue-900">{selectedApartment.size_m2} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Price:</span>
                      <span className="font-bold text-blue-900">${selectedApartment.price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Status:</span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedApartment.status === 'Sold' ? 'bg-green-100 text-green-800' :
                        selectedApartment.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedApartment.status}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedApartment.customer && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-3">Customer Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-green-700">Name:</span>
                        <span className="font-medium text-green-900">
                          {selectedApartment.customer.name} {selectedApartment.customer.surname}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">Email:</span>
                        <span className="font-medium text-green-900">{selectedApartment.customer.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">Phone:</span>
                        <span className="font-medium text-green-900">{selectedApartment.customer.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">ID Number:</span>
                        <span className="font-medium text-green-900">{selectedApartment.customer.id_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">Bank Account:</span>
                        <span className="font-medium text-green-900">{selectedApartment.customer.bank_account}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {selectedApartment.sale && (
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-4">Payment Information</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        {getPaymentMethodIcon(selectedApartment.sale.payment_method)}
                        <span className="font-medium text-purple-900 capitalize">
                          {selectedApartment.sale.payment_method.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-purple-700">Sale Price:</span>
                          <span className="font-medium">${selectedApartment.sale.sale_price.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700">Down Payment:</span>
                          <span className="font-medium">${selectedApartment.sale.down_payment.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700">Total Paid:</span>
                          <span className="font-medium text-green-600">${selectedApartment.sale.total_paid.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700">Remaining:</span>
                          <span className="font-medium text-red-600">${selectedApartment.sale.remaining_amount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-purple-900 mb-2">Payment Schedule</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-purple-700">Monthly Payment:</span>
                          <span className="font-medium">${selectedApartment.sale.monthly_payment.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700">Next Payment:</span>
                          <span className="font-medium">
                            {selectedApartment.sale.next_payment_date 
                              ? format(new Date(selectedApartment.sale.next_payment_date), 'MMM dd, yyyy')
                              : 'N/A'
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700">Contract:</span>
                          <span className={`font-medium ${
                            selectedApartment.sale.contract_signed ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {selectedApartment.sale.contract_signed ? 'Signed' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-purple-700">Payment Progress</span>
                      <span className="text-sm font-medium">
                        {((selectedApartment.sale.total_paid / selectedApartment.sale.sale_price) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-3">
                      <div 
                        className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${(selectedApartment.sale.total_paid / selectedApartment.sale.sale_price) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {selectedApartment.sale.notes && (
                    <div>
                      <h5 className="font-medium text-purple-900 mb-2">Notes</h5>
                      <p className="text-sm text-purple-700 bg-white p-3 rounded border">
                        {selectedApartment.sale.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesProjects

export default SalesProjects