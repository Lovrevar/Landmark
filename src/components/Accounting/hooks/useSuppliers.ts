import { useState, useEffect } from 'react'
import { SupplierSummary, SupplierFormData, Project, Phase } from '../types/supplierTypes'
import * as supplierService from '../services/supplierService'
import { lockBodyScroll, unlockBodyScroll } from '../../../hooks/useModalOverflow'

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null)
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null)
  const [showRetailModal, setShowRetailModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)

  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    contact: '',
    project_id: '',
    phase_id: ''
  })

  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  const itemsPerPage = 50

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await supplierService.fetchSuppliers()
      setSuppliers(data)
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    try {
      setLoadingProjects(true)
      const data = await supplierService.fetchProjects()
      setProjects(data)
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  const loadPhases = async (projectId: string) => {
    try {
      const data = await supplierService.fetchPhases(projectId)
      setPhases(data)
    } catch (error) {
      console.error('Error loading phases:', error)
      setPhases([])
    }
  }

  useEffect(() => {
    if (formData.project_id) {
      loadPhases(formData.project_id)
    } else {
      setPhases([])
    }
  }, [formData.project_id])

  const handleOpenAddModal = (supplier?: SupplierSummary) => {
    if (supplier) {
      setEditingSupplier(supplier.id)
      setFormData({
        name: supplier.name,
        contact: supplier.contact,
        project_id: '',
        phase_id: ''
      })
    } else {
      setEditingSupplier(null)
      setFormData({
        name: '',
        contact: '',
        project_id: '',
        phase_id: ''
      })
      loadProjects()
    }
    lockBodyScroll()
    setShowAddModal(true)
  }

  const handleCloseAddModal = () => {
    unlockBodyScroll()
    setShowAddModal(false)
    setEditingSupplier(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingSupplier && formData.project_id && !formData.phase_id) {
      alert('Molimo odaberite fazu za odabrani projekt')
      return
    }

    try {
      if (editingSupplier) {
        await supplierService.updateSupplier(editingSupplier, formData)
      } else {
        await supplierService.createSupplier(formData)
      }

      await fetchData()
      handleCloseAddModal()
    } catch (error: any) {
      console.error('Error saving supplier:', error)

      if (error?.code === '23505' && error?.message?.includes('contract_number')) {
        alert('Greška: Dupliran broj ugovora. Molimo pokušajte ponovo.')
      } else if (error?.message) {
        alert(`Greška: ${error.message}`)
      } else {
        alert('Greška prilikom spremanja dobavljača')
      }
    }
  }

  const handleDelete = async (supplier: SupplierSummary) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovog dobavljača? Ovo će obrisati sve vezane ugovore i račune.')) return

    try {
      await supplierService.deleteSupplier(supplier)
      await fetchData()
    } catch (error) {
      console.error('Error deleting supplier:', error)
      alert('Greška prilikom brisanja dobavljača')
    }
  }

  const handleViewDetails = async (supplier: SupplierSummary) => {
    try {
      const { contracts, invoices } = await supplierService.fetchSupplierDetails(supplier)
      setSelectedSupplier({ ...supplier, contracts, invoices })
      lockBodyScroll()
      setShowDetailsModal(true)
    } catch (error) {
      console.error('Error loading supplier details:', error)
      alert('Greška prilikom učitavanja detalja dobavljača')
    }
  }

  const handleCloseDetailsModal = () => {
    unlockBodyScroll()
    setShowDetailsModal(false)
    setSelectedSupplier(null)
  }

  const handleOpenLinkModal = () => {
    lockBodyScroll()
    setShowLinkModal(true)
  }

  const handleCloseLinkModal = () => {
    unlockBodyScroll()
    setShowLinkModal(false)
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  return {
    suppliers,
    loading,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    showAddModal,
    showDetailsModal,
    selectedSupplier,
    editingSupplier,
    showRetailModal,
    setShowRetailModal,
    showLinkModal,
    formData,
    setFormData,
    projects,
    phases,
    loadingProjects,
    itemsPerPage,
    filteredSuppliers,
    paginatedSuppliers,
    totalPages,
    startIndex,
    endIndex,
    fetchData,
    handleOpenAddModal,
    handleCloseAddModal,
    handleSubmit,
    handleDelete,
    handleViewDetails,
    handleCloseDetailsModal,
    handleOpenLinkModal,
    handleCloseLinkModal
  }
}
