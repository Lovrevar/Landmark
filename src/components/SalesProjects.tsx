import React, { useState, useEffect } from 'react'
import { supabase, Project, Apartment, Customer, Sale } from '../lib/supabase'
import { 
  Building2, 
  Plus, 
  Home, 
  DollarSign, 
  Users, 
  Calendar,
  TrendingUp,
  Edit2,
  Trash2,
  X,
  Eye,
  CheckCircle,
  Clock,
  CreditCard,
  User,
  Mail,
  Phone,
  MapPin
} from 'lucide-react'
import { format } from 'date-fns'

interface ApartmentWithSale extends Apartment {
  sale_info?: {
    sale_price: number
    payment_method: string
    down_payment: number
    total_paid: number
    remaining_amount: number
    monthly_payment: number
    sale_date: string
    contract_signed: boolean
    buyer_name: string
    buyer_email: string
    buyer_phone: string
  }
}

interface ProjectWithApartments extends Project {
  apartments: ApartmentWithSale[]
  total_units: number
  sold_units: number
  available_units: number
  reserved_units: number
  total_revenue: number
  average_price: number
}

const SalesProjects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWithApartments[]>([])
  const [apartments, setApartments] = useState<ApartmentWithSale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithApartments | null>(null)
  const [selectedApartments, setSelectedApartments] = useState<Set<string>>(new Set())
  const [showAddApartmentForm, setShowAddApartmentForm] = useState(false)
  const [showBulkCreateForm, setShowBulkCreateForm] = useState(false)
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null)
  const [apartmentForSale, setApartmentForSale] = useState<Apartment | null>(null)
  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('new')
  const [newApartment, setNewApartment] = useState({
    number: '',
    floor: 1,
    size_m2: 0,
    price_per_sqm: 0,
    price: 0
  })
  const [bulkCreate, setBulkCreate] = useState({
    floor_start: 1,
    floor_end: 10,
    apartments_per_floor: 4,
    base_size: 85,
    size_variation: 15,
    base_price_per_m2: 5000,
    floor_increment: 10000
  })
  const [saleData, setSaleData] = useState({
    customer_id: '',
    sale_price: 0,
    payment_method: 'bank_loan' as const,
    down_payment: 0,
    monthly_payment: 0,
    sale_date: format(new Date(), 'yyyy-MM-dd'),
    contract_signed: false,
    notes: '',
    buyer_name: '',
    buyer_email: '',
    buyer_phone: '',
    buyer_address: ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])
  const [filterStatus, setFilterStatus] = useState<'all' | 'Available' | 'Reserved' | 'Sold'>('all')
  // Filtered list gpt
  const filteredApartments = apartments.filter(apt => 
    filterStatus === 'all' ? true : apt.status === filterStatus
)
  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      if (projectsError) throw projectsError

      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name')

      if (customersError) throw customersError

      // Fetch apartments with sales data
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('*')
        .order('project_id')
        .order('floor')
        .order('number')

      if (apartmentsError) throw apartmentsError

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          customers(name, surname, email, phone)
        `)

      if (salesError) throw salesError

      // Enhance apartments with sale information
      const apartmentsWithSales = (apartmentsData || []).map(apartment => {
        const sale = (salesData || []).find(s => s.apartment_id === apartment.id)
        if (sale && apartment.status === 'Sold') {
          return {
            ...apartment,
            sale_info: {
              sale_price: sale.sale_price,
              payment_method: sale.payment_method,
              down_payment: sale.down_payment,
              total_paid: sale.total_paid,
              remaining_amount: sale.remaining_amount,
              monthly_payment: sale.monthly_payment,
              sale_date: sale.sale_date,
              contract_signed: sale.contract_signed,
              buyer_name: sale.customers ? `${sale.customers.name} ${sale.customers.surname}` : apartment.buyer_name || 'Unknown',
              buyer_email: sale.customers?.email || '',
              buyer_phone: sale.customers?.phone || ''
            }
          }
        }
        return apartment
      })

      // Process projects with apartment statistics
      const projectsWithApartments = (projectsData || []).map(project => {
        const projectApartments = apartmentsWithSales.filter(apt => apt.project_id === project.id)
        const total_units = projectApartments.length
        const sold_units = projectApartments.filter(apt => apt.status === 'Sold').length
        const available_units = projectApartments.filter(apt => apt.status === 'Available').length
        const reserved_units = projectApartments.filter(apt => apt.status === 'Reserved').length
        const total_revenue = projectApartments
          .filter(apt => apt.status === 'Sold')
          .reduce((sum, apt) => sum + (apt.sale_info?.sale_price || apt.price), 0)
        const average_price = total_units > 0 
          ? projectApartments.reduce((sum, apt) => sum + apt.price, 0) / total_units 
          : 0

        return {
          ...project,
          apartments: projectApartments,
          total_units,
          sold_units,
          available_units,
          reserved_units,
          total_revenue,
          average_price
        }
      })

      setProjects(projectsWithApartments)
      setCustomers(customersData || [])
      
      if (selectedProject) {
        const updatedSelectedProject = projectsWithApartments.find(p => p.id === selectedProject.id)
        if (updatedSelectedProject) {
          setSelectedProject(updatedSelectedProject)
          setApartments(updatedSelectedProject.apartments)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate price when size_m2 or price_per_sqm changes
  const calculatePrice = (size: number, pricePerSqm: number) => {
    return size * pricePerSqm
  }

  const handleSizeChange = (size: number) => {
    const calculatedPrice = calculatePrice(size, newApartment.price_per_sqm)
    setNewApartment({ 
      ...newApartment, 
      size_m2: size, 
      price: calculatedPrice 
    })
  }

  const handlePricePerSqmChange = (pricePerSqm: number) => {
    const calculatedPrice = calculatePrice(newApartment.size_m2, pricePerSqm)
    setNewApartment({ 
      ...newApartment, 
      price_per_sqm: pricePerSqm, 
      price: calculatedPrice 
    })
  }

  const handleBulkSizeChange = (size: number) => {
    const calculatedPrice = calculatePrice(size, bulkCreate.price_per_sqm)
    setBulkCreate({ 
      ...bulkCreate, 
      size_m2: size, 
      price: calculatedPrice 
    })
  }

  const handleBulkPricePerSqmChange = (pricePerSqm: number) => {
    const calculatedPrice = calculatePrice(bulkCreate.size_m2, pricePerSqm)
    setBulkCreate({ 
      ...bulkCreate, 
      price_per_sqm: pricePerSqm, 
      price: calculatedPrice 
    })
  }

  const addApartment = async () => {
    if (!selectedProject || !newApartment.number.trim()) {
      alert('Please fill in required fields')
      return
    }

    try {
      const { data, error } = await supabase
        .from('apartments')
        .insert({
          project_id: selectedProject.id,
          number: newApartment.number,
          floor: newApartment.floor,
          size_m2: newApartment.size_m2,
          price: newApartment.price,
          status: 'Available'
        })
        .select()
        .single()

      if (error) throw error

      // Update local state immediately
      const newApt = data as ApartmentWithSale
      setApartments(prev => [...prev, newApt])
      
      resetApartmentForm()
      fetchData() // Refresh to ensure consistency
    } catch (error) {
      console.error('Error adding apartment:', error)
      alert('Error adding apartment. Please try again.')
    }
  }

  const bulkCreateApartments = async () => {
    if (!selectedProject) return

    const apartmentsToCreate = []
    
    for (let floor = bulkCreate.floor_start; floor <= bulkCreate.floor_end; floor++) {
      for (let apt = 1; apt <= bulkCreate.apartments_per_floor; apt++) {
        const sizeVariation = (Math.random() - 0.5) * bulkCreate.size_variation
        const size = Math.round(bulkCreate.base_size + sizeVariation)
        const floorPremium = (floor - 1) * bulkCreate.floor_increment
        const price = Math.round((size * bulkCreate.base_price_per_m2) + floorPremium)
        
        apartmentsToCreate.push({
          project_id: selectedProject.id,
          number: `${floor}${apt.toString().padStart(2, '0')}`,
          floor: floor,
          size_m2: size,
          price: price,
          status: 'Available'
        })
      }
    }

    try {
      const { data, error } = await supabase
        .from('apartments')
        .insert(apartmentsToCreate)
        .select()

      if (error) throw error

      // Update local state immediately
      const newApartments = data as ApartmentWithSale[]
      setApartments(prev => [...prev, ...newApartments])
      
      resetBulkCreateForm()
      fetchData() // Refresh to ensure consistency
    } catch (error) {
      console.error('Error bulk creating apartments:', error)
      alert('Error creating apartments. Please try again.')
    }
  }

  const updateApartment = async () => {
    if (!editingApartment || !newApartment.number.trim()) return

    try {
      const { data, error } = await supabase
        .from('apartments')
        .update({
          number: newApartment.number,
          floor: newApartment.floor,
          size_m2: newApartment.size_m2,
          price: newApartment.price
        })
        .eq('id', editingApartment.id)
        .select()
        .single()

      if (error) throw error

      // Update local state immediately
      setApartments(prev => prev.map(apt => apt.id === editingApartment.id ? data as ApartmentWithSale : apt))
      
      resetApartmentForm()
      fetchData() // Refresh to ensure consistency
    } catch (error) {
      console.error('Error updating apartment:', error)
      alert('Error updating apartment.')
    }
  }

  const deleteApartment = async (apartmentId: string) => {
    if (!confirm('Are you sure you want to delete this apartment?')) return

    try {
      const { error } = await supabase
        .from('apartments')
        .delete()
        .eq('id', apartmentId)

      if (error) throw error

      // Update local state immediately
      setApartments(prev => prev.filter(apt => apt.id !== apartmentId))
      
      fetchData() // Refresh to ensure consistency
    } catch (error) {
      console.error('Error deleting apartment:', error)
      alert('Error deleting apartment.')
    }
  }

  const deleteSelectedApartments = async () => {
    if (selectedApartments.size === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedApartments.size} selected apartments?`)) return

    try {
      const { error } = await supabase
        .from('apartments')
        .delete()
        .in('id', Array.from(selectedApartments))

      if (error) throw error

      // Update local state immediately
      setApartments(prev => prev.filter(apt => !selectedApartments.has(apt.id)))
      setSelectedApartments(new Set())
      
      fetchData() // Refresh to ensure consistency
    } catch (error) {
      console.error('Error deleting apartments:', error)
      alert('Error deleting apartments.')
    }
  }

  const completeSale = async () => {
    if (!apartmentForSale) return

    try {
      let customerId = saleData.customer_id

      // Create new customer if needed
      if (customerMode === 'new') {
        if (!saleData.buyer_name.trim() || !saleData.buyer_email.trim()) {
          alert('Please fill in buyer name and email')
          return
        }

        const [firstName, ...lastNameParts] = saleData.buyer_name.trim().split(' ')
        const lastName = lastNameParts.join(' ') || firstName

        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: firstName,
            surname: lastName,
            email: saleData.buyer_email,
            phone: saleData.buyer_phone || '',
            address: saleData.buyer_address || '',
            status: 'buyer'
          })
          .select()
          .single()

        if (customerError) throw customerError
        customerId = newCustomer.id
      }

      // Calculate remaining amount
      const remaining_amount = saleData.sale_price - saleData.down_payment

      // Create sale record
      const { data: saleRecord, error: saleError } = await supabase
        .from('sales')
        .insert({
          apartment_id: apartmentForSale.id,
          customer_id: customerId,
          sale_price: saleData.sale_price,
          payment_method: saleData.payment_method,
          down_payment: saleData.down_payment,
          total_paid: saleData.down_payment,
          remaining_amount: remaining_amount,
          monthly_payment: saleData.monthly_payment,
          sale_date: saleData.sale_date,
          contract_signed: saleData.contract_signed,
          notes: saleData.notes
        })
        .select()
        .single()

      if (saleError) throw saleError

      // Update apartment status and buyer name
      const { error: apartmentError } = await supabase
        .from('apartments')
        .update({ 
          status: 'Sold',
          buyer_name: saleData.buyer_name
        })
        .eq('id', apartmentForSale.id)

      if (apartmentError) throw apartmentError

      // Update local state immediately with complete sale information
      setApartments(prev => prev.map(apt => {
        if (apt.id === apartmentForSale.id) {
          return {
            ...apt,
            status: 'Sold' as const,
            buyer_name: saleData.buyer_name,
            sale_info: {
              sale_price: saleData.sale_price,
              payment_method: saleData.payment_method,
              down_payment: saleData.down_payment,
              total_paid: saleData.down_payment,
              remaining_amount: remaining_amount,
              monthly_payment: saleData.monthly_payment,
              sale_date: saleData.sale_date,
              contract_signed: saleData.contract_signed,
              buyer_name: saleData.buyer_name,
              buyer_email: saleData.buyer_email,
              buyer_phone: saleData.buyer_phone
            }
          }
        }
        return apt
      }))

      resetSaleForm()
      fetchData() // Refresh to ensure consistency
    } catch (error) {
      console.error('Error completing sale:', error)
      alert('Error completing sale. Please try again.')
    }
  }

  const updateApartmentStatus = async (apartmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('apartments')
        .update({ 
          status: newStatus,
          buyer_name: newStatus === 'Available' ? null : undefined
        })
        .eq('id', apartmentId)

      if (error) throw error

      // Update local state immediately
      setApartments(prev => prev.map(apt => 
        apt.id === apartmentId 
          ? { 
              ...apt, 
              status: newStatus as any,
              buyer_name: newStatus === 'Available' ? null : apt.buyer_name,
              sale_info: newStatus === 'Available' ? undefined : apt.sale_info
            }
          : apt
      ))
      
      fetchData() // Refresh to ensure consistency
    } catch (error) {
      console.error('Error updating apartment status:', error)
      alert('Error updating apartment status.')
    }
  }

  const resetApartmentForm = () => {
    setNewApartment({
      number: '',
      floor: 1,
      size_m2: 0,
      price_per_sqm: 0,
      price: 0
    })
    setEditingApartment(null)
    setShowAddApartmentForm(false)
  }

  const resetBulkCreateForm = () => {
    setBulkCreate({
      floor_start: 1,
      floor_end: 10,
      apartments_per_floor: 4,
      base_size: 85,
      size_variation: 15,
      base_price_per_m2: 5000,
      floor_increment: 10000
    })
    setShowBulkCreateForm(false)
  }

  const resetSaleForm = () => {
    setSaleData({
      customer_id: '',
      sale_price: 0,
      payment_method: 'bank_loan',
      down_payment: 0,
      monthly_payment: 0,
      sale_date: format(new Date(), 'yyyy-MM-dd'),
      contract_signed: false,
      notes: '',
      buyer_name: '',
      buyer_email: '',
      buyer_phone: '',
      buyer_address: ''
    })
    setApartmentForSale(null)
    setShowSaleForm(false)
    setCustomerMode('new')
  }

  const handleEditApartment = (apartment: Apartment) => {
    setEditingApartment(apartment)
    setNewApartment({
      number: apartment.number,
      floor: apartment.floor,
      size_m2: apartment.size_m2,
      price_per_sqm: 0,
      price: apartment.price
    })
    setShowAddApartmentForm(true)
  }

  const handleSellApartment = (apartment: Apartment) => {
    setApartmentForSale(apartment)
    setSaleData(prev => ({
      ...prev,
      sale_price: apartment.price // Default to list price
    }))
    setShowSaleForm(true)
  }

  const handleApartmentClick = (apartmentId: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      setSelectedApartments(prev => {
        const newSet = new Set(prev)
        if (newSet.has(apartmentId)) {
          newSet.delete(apartmentId)
        } else {
          newSet.add(apartmentId)
        }
        return newSet
      })
    }
  }

  const calculateBulkPreview = () => {
    const floors = bulkCreate.floor_end - bulkCreate.floor_start + 1
    const totalApartments = floors * bulkCreate.apartments_per_floor
    const avgSize = bulkCreate.base_size
    const avgPrice = (avgSize * bulkCreate.base_price_per_m2) + 
                    ((bulkCreate.floor_start + bulkCreate.floor_end) / 2 - 1) * bulkCreate.floor_increment
    const totalValue = totalApartments * avgPrice

    return { totalApartments, avgSize, avgPrice, totalValue }
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

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => {
              setSelectedProject(project)
              setApartments(project.apartments)
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                <p className="text-sm text-gray-600">{project.location}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {project.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{project.total_units}</p>
                <p className="text-xs text-gray-600">Total Units</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{project.sold_units}</p>
                <p className="text-xs text-gray-600">Sold</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Sales Progress</span>
                <span className="text-sm font-medium">
                  {project.total_units > 0 ? ((project.sold_units / project.total_units) * 100).toFixed(1) : '0'}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${project.total_units > 0 ? (project.sold_units / project.total_units) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Revenue</span>
                <span className="font-bold text-green-600">${project.total_revenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Project Details */}
      {selectedProject && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedProject.name}</h2>
                <p className="text-gray-600">{selectedProject.location}</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowAddApartmentForm(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Apartment
                </button>
                <button
                  onClick={() => setShowBulkCreateForm(true)}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Bulk Create
                </button>
              </div>
            </div>
          </div>

          {/* Multi-select Actions */}
          {selectedApartments.size > 0 && (
            <div className="p-4 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-blue-800 font-medium">
                  {selectedApartments.size} apartment(s) selected
                </span>
                <div className="flex space-x-3">
                  <button
                    onClick={deleteSelectedApartments}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    Delete Selected
                  </button>
                  <button
                    onClick={() => setSelectedApartments(new Set())}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Apartments Grid */}
          <div className="p-6">
            {apartments.length === 0 ? (
              <div className="text-center py-12">
                <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Apartments</h3>
                <p className="text-gray-600 mb-4">This project doesn't have any apartments yet.</p>
                <button
                  onClick={() => setShowBulkCreateForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Apartments
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {apartments.map((apartment) => (
                  <div
                    key={apartment.id}
                    onClick={(e) => handleApartmentClick(apartment.id, e)}
                    className={`rounded-xl shadow-sm border p-4 transition-all duration-200 cursor-pointer ${
                      selectedApartments.has(apartment.id)
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : apartment.status === 'Sold' 
                          ? 'border-green-200 bg-green-50 hover:shadow-md'
                          : apartment.status === 'Reserved'
                            ? 'border-yellow-200 bg-yellow-50 hover:shadow-md'
                            : 'border-gray-200 bg-white hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">Unit {apartment.number}</h4>
                        <p className="text-sm text-gray-600">Floor {apartment.floor}</p>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditApartment(apartment)
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteApartment(apartment.id)
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
                      
                      {apartment.status === 'Sold' && apartment.sale_info && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Buyer:</span>
                            <span className="text-sm font-medium">{apartment.sale_info.buyer_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Sale Price:</span>
                            <span className="text-sm font-bold text-green-600">${apartment.sale_info.sale_price.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Down Payment:</span>
                            <span className="text-sm font-medium">${apartment.sale_info.down_payment.toLocaleString()}</span>
                          </div>
                          {apartment.sale_info.monthly_payment > 0 && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Monthly:</span>
                              <span className="text-sm font-medium">${apartment.sale_info.monthly_payment.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="mt-2">
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-gray-500">Payment Progress</span>
                              <span className="text-xs font-medium">
                                ${apartment.sale_info.total_paid.toLocaleString()} / ${apartment.sale_info.sale_price.toLocaleString()}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className="bg-green-600 h-1.5 rounded-full"
                                style={{ 
                                  width: `${apartment.sale_info.sale_price > 0 ? (apartment.sale_info.total_paid / apartment.sale_info.sale_price) * 100 : 0}%` 
                                }}
                              ></div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          apartment.status === 'Sold' ? 'bg-green-100 text-green-800' :
                          apartment.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {apartment.status}
                        </span>
                        
                        {apartment.status !== 'Sold' && (
                          <div className="flex space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSellApartment(apartment)
                              }}
                              className="px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-medium transition-colors duration-200"
                            >
                              Mark Sold
                            </button>
                            {apartment.status === 'Available' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateApartmentStatus(apartment.id, 'Reserved')
                                }}
                                className="px-2 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded text-xs font-medium transition-colors duration-200"
                              >
                                Reserve
                              </button>
                            )}
                            {apartment.status === 'Reserved' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateApartmentStatus(apartment.id, 'Available')
                                }}
                                className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-medium transition-colors duration-200"
                              >
                                Available
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Apartment Form Modal */}
      {showAddApartmentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingApartment ? 'Edit Apartment' : 'Add New Apartment'}
                </h3>
                <button
                  onClick={resetApartmentForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit Number *</label>
                  <input
                    type="text"
                    value={newApartment.number}
                    onChange={(e) => setNewApartment({ ...newApartment, number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 101, A-205"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Floor *</label>
                  <input
                    type="number"
                    min="1"
                    value={newApartment.floor}
                    onChange={(e) => setNewApartment({ ...newApartment, floor: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size (m²) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newApartment.size_m2}
                    onChange={(e) => handleSizeChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price per m² ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newApartment.price_per_sqm}
                    onChange={(e) => handlePricePerSqmChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Price ($)</label>
                  <input
                    type="number"
                    value={newApartment.price}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                    placeholder="Calculated automatically"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Calculated: {newApartment.size_m2} m² × ${newApartment.price_per_sqm}/m² = ${newApartment.price.toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={resetApartmentForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingApartment ? updateApartment : addApartment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {editingApartment ? 'Update' : 'Add'} Apartment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Form Modal */}
      {showBulkCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Bulk Create Apartments</h3>
                <button
                  onClick={resetBulkCreateForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Floor</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkCreate.floor_start}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, floor_start: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Floor</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkCreate.floor_end}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, floor_end: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Apartments per Floor</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkCreate.apartments_per_floor}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, apartments_per_floor: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base Size (m²)</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCreate.base_size}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, base_size: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size Variation (±m²)</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCreate.size_variation}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, size_variation: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base Price per m²</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCreate.base_price_per_m2}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, base_price_per_m2: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Floor Premium ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCreate.floor_increment}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, floor_increment: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">Preview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Total Apartments:</span>
                    <span className="font-medium text-blue-900 ml-2">
                      {calculateBulkPreview().totalApartments}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Avg. Size:</span>
                    <span className="font-medium text-blue-900 ml-2">
                      {calculateBulkPreview().avgSize} m²
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Avg. Price:</span>
                    <span className="font-medium text-blue-900 ml-2">
                      ${calculateBulkPreview().avgPrice.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Total Value:</span>
                    <span className="font-medium text-blue-900 ml-2">
                      ${calculateBulkPreview().totalValue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={resetBulkCreateForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={bulkCreateApartments}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Create {calculateBulkPreview().totalApartments} Apartments
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sale Form Modal */}
      {showSaleForm && apartmentForSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Complete Sale - Unit {apartmentForSale.number}
                </h3>
                <button
                  onClick={resetSaleForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Customer Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Customer</label>
                <div className="flex space-x-4 mb-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="new"
                      checked={customerMode === 'new'}
                      onChange={(e) => setCustomerMode(e.target.value as 'new' | 'existing')}
                      className="mr-2"
                    />
                    Create New Customer
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="existing"
                      checked={customerMode === 'existing'}
                      onChange={(e) => setCustomerMode(e.target.value as 'new' | 'existing')}
                      className="mr-2"
                    />
                    Select Existing Customer
                  </label>
                </div>

                {customerMode === 'existing' ? (
                  <select
                    value={saleData.customer_id}
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value)
                      setSaleData({ 
                        ...saleData, 
                        customer_id: e.target.value,
                        buyer_name: customer ? `${customer.name} ${customer.surname}` : '',
                        buyer_email: customer?.email || '',
                        buyer_phone: customer?.phone || ''
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.surname} - {customer.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                      <input
                        type="text"
                        value={saleData.buyer_name}
                        onChange={(e) => setSaleData({ ...saleData, buyer_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Smith"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={saleData.buyer_email}
                        onChange={(e) => setSaleData({ ...saleData, buyer_email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="john@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={saleData.buyer_phone}
                        onChange={(e) => setSaleData({ ...saleData, buyer_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                      <input
                        type="text"
                        value={saleData.buyer_address}
                        onChange={(e) => setSaleData({ ...saleData, buyer_address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="123 Main St, City, State"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sale Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sale Price ($) *</label>
                  <input
                    type="number"
                    min="0"
                    value={saleData.sale_price}
                    onChange={(e) => setSaleData({ ...saleData, sale_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Down Payment ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={saleData.down_payment}
                    onChange={(e) => setSaleData({ ...saleData, down_payment: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Payment ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={saleData.monthly_payment}
                    onChange={(e) => setSaleData({ ...saleData, monthly_payment: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sale Date</label>
                  <input
                    type="date"
                    value={saleData.sale_date}
                    onChange={(e) => setSaleData({ ...saleData, sale_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="contract_signed"
                    checked={saleData.contract_signed}
                    onChange={(e) => setSaleData({ ...saleData, contract_signed: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="contract_signed" className="text-sm font-medium text-gray-700">
                    Contract Signed
                  </label>
                </div>
              </div>

              {/* Sale Summary */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Sale Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Sale Price:</span>
                    <span className="font-medium text-gray-900 ml-2">${saleData.sale_price.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Down Payment:</span>
                    <span className="font-medium text-gray-900 ml-2">${saleData.down_payment.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-medium text-gray-900 ml-2">
                      ${(saleData.sale_price - saleData.down_payment).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Monthly Payment:</span>
                    <span className="font-medium text-gray-900 ml-2">${saleData.monthly_payment.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={saleData.notes}
                  onChange={(e) => setSaleData({ ...saleData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional sale notes..."
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={resetSaleForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={completeSale}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Complete Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesProjects