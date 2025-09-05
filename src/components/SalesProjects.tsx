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
  PiggyBank
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
  const [selectedProject, setSelectedProject] = useState<ProjectWithApartments | null>(null)
  const [selectedApartment, setSelectedApartment] = useState<ApartmentWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (projectsError) throw projectsError

      // Fetch apartments with project details
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select(`
          *,
          projects!inner(name)
        `)
        .order('project_id')
        .order('floor')
        .order('number')

      if (apartmentsError) throw apartmentsError

      // For demo purposes, we'll simulate customer and sale data
      // In a real app, you'd fetch from customers and sales tables
      const apartmentsWithDetails = (apartmentsData || []).map(apt => ({
        ...apt,
        project_name: apt.projects.name,
        customer: apt.status === 'Sold' ? {
          id: `customer-${apt.id}`,
          name: apt.buyer_name?.split(' ')[0] || 'John',
          surname: apt.buyer_name?.split(' ')[1] || 'Doe',
          email: `${apt.buyer_name?.toLowerCase().replace(' ', '.')}@email.com` || 'john.doe@email.com',
          phone: '+1-555-0123',
          address: '123 Main St, City',
          bank_account: 'XXXX-XXXX-XXXX-1234',
          id_number: 'ID123456789',
          status: 'buyer' as const,
          created_at: apt.created_at
        } : undefined,
        sale: apt.status === 'Sold' ? {
          id: `sale-${apt.id}`,
          apartment_id: apt.id,
          customer_id: `customer-${apt.id}`,
          sale_price: apt.price,
          payment_method: Math.random() > 0.5 ? 'bank_loan' as const : 'installments' as const,
          down_payment: apt.price * 0.2,
          total_paid: apt.price * (0.2 + Math.random() * 0.5),
          remaining_amount: apt.price * (0.3 + Math.random() * 0.5),
          next_payment_date: '2025-02-15',
          monthly_payment: apt.price * 0.05,
          sale_date: apt.created_at,
          contract_signed: true,
          notes: 'Regular payment schedule',
          created_at: apt.created_at
        } : undefined
      }))

      // Group apartments by project and calculate stats
      const projectsWithApartments = (projectsData || []).map(project => {
        const projectApartments = apartmentsWithDetails.filter(apt => apt.project_id === project.id)
        
        const total_apartments = projectApartments.length
        const sold_apartments = projectApartments.filter(apt => apt.status === 'Sold').length
        const available_apartments = projectApartments.filter(apt => apt.status === 'Available').length
        const reserved_apartments = projectApartments.filter(apt => apt.status === 'Reserved').length
        const total_revenue = projectApartments
          .filter(apt => apt.status === 'Sold')
          .reduce((sum, apt) => sum + apt.price, 0)
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
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateApartmentStatus = async (apartmentId: string, newStatus: string, buyerName?: string) => {
    const updateData: any = { status: newStatus }
    if (newStatus === 'Sold' && buyerName) {
      updateData.buyer_name = buyerName
    } else if (newStatus === 'Available') {
      updateData.buyer_name = null
    }

    const { error } = await supabase
      .from('apartments')
      .update(updateData)
      .eq('id', apartmentId)

    if (!error) {
      fetchProjects()
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
                      {apartment.buyer_name && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Buyer:</span>
                          <span className="text-sm font-medium">{apartment.buyer_name}</span>
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
                      <div className="mt-3 pt-3 border-t">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const buyerName = prompt('Enter buyer name:')
                            if (buyerName) {
                              updateApartmentStatus(apartment.id, 'Sold', buyerName)
                            }
                          }}
                          className="w-full px-3 py-1 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors duration-200"
                        >
                          Mark as Sold
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apartment Details Modal */}
      {selectedApartment && (
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