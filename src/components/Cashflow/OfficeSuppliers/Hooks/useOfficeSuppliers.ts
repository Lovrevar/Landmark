import { useState, useEffect } from 'react'
import { OfficeSupplier, OfficeSupplierWithStats, Invoice, OfficeSupplierFormData } from '../types'
import { lockBodyScroll, unlockBodyScroll } from '../../../../hooks/useModalOverflow'
import {
  fetchSuppliersWithStats,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  fetchSupplierInvoices
} from '../Services/officeSupplierService'
import { useToast } from '../../../../contexts/ToastContext'

export const useOfficeSuppliers = () => {
  const toast = useToast()
  const [suppliers, setSuppliers] = useState<OfficeSupplierWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<OfficeSupplier | null>(null)
  const [showInvoicesModal, setShowInvoicesModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<OfficeSupplierWithStats | null>(null)
  const [supplierInvoices, setSupplierInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  const [formData, setFormData] = useState<OfficeSupplierFormData>({
    name: '',
    contact: '',
    email: '',
    address: '',
    tax_id: '',
    vat_id: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await fetchSuppliersWithStats()
      setSuppliers(data)
    } catch (error) {
      console.error('Error fetching office suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (supplier?: OfficeSupplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setFormData({
        name: supplier.name,
        contact: supplier.contact || '',
        email: supplier.email || '',
        address: supplier.address || '',
        tax_id: supplier.tax_id || '',
        vat_id: supplier.vat_id || ''
      })
    } else {
      setEditingSupplier(null)
      setFormData({
        name: '',
        contact: '',
        email: '',
        address: '',
        tax_id: '',
        vat_id: ''
      })
    }
    lockBodyScroll()
    setShowModal(true)
  }

  const handleCloseModal = () => {
    unlockBodyScroll()
    setShowModal(false)
    setEditingSupplier(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formData)
      } else {
        await createSupplier(formData)
      }

      await fetchData()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving office supplier:', error)
      toast.error('Greška prilikom spremanja dobavljača')
    }
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = (id: string) => setPendingDeleteId(id)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      await deleteSupplier(pendingDeleteId)
      await fetchData()
    } catch (error) {
      console.error('Error deleting office supplier:', error)
      toast.error('Greška prilikom brisanja dobavljača')
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  const cancelDelete = () => setPendingDeleteId(null)

  const handleViewInvoices = async (supplier: OfficeSupplierWithStats) => {
    setSelectedSupplier(supplier)
    setShowInvoicesModal(true)
    setLoadingInvoices(true)
    lockBodyScroll()

    try {
      const invoices = await fetchSupplierInvoices(supplier.id)
      setSupplierInvoices(invoices)
    } catch (error) {
      console.error('Error fetching supplier invoices:', error)
      toast.error('Greška prilikom učitavanja računa')
    } finally {
      setLoadingInvoices(false)
    }
  }

  const handleCloseInvoicesModal = () => {
    unlockBodyScroll()
    setShowInvoicesModal(false)
    setSelectedSupplier(null)
    setSupplierInvoices([])
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.contact || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return {
    suppliers,
    loading,
    searchTerm,
    setSearchTerm,
    showModal,
    editingSupplier,
    showInvoicesModal,
    selectedSupplier,
    supplierInvoices,
    loadingInvoices,
    formData,
    setFormData,
    filteredSuppliers,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    handleViewInvoices,
    handleCloseInvoicesModal
  }
}
