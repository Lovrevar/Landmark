import { useState, useEffect } from 'react'
import {
  Company,
  RetailSupplier,
  RetailCustomer,
  RetailProject,
  RetailContract,
  RetailMilestone,
  InvoiceCategory,
  Refund,
  RetailInvoiceFormData
} from '../retailInvoiceTypes'
import {
  fetchRetailInvoiceInitialData,
  fetchRetailSuppliers,
  fetchRetailCustomers,
  fetchRetailContracts,
  fetchRetailMilestones,
} from '../services/retailInvoiceFormDataService'

export const useRetailInvoiceData = (formData: RetailInvoiceFormData) => {
  const [companies, setCompanies] = useState<Company[]>([])
  const [suppliers, setSuppliers] = useState<RetailSupplier[]>([])
  const [customers, setCustomers] = useState<RetailCustomer[]>([])
  const [projects, setProjects] = useState<RetailProject[]>([])
  const [contracts, setContracts] = useState<RetailContract[]>([])
  const [milestones, setMilestones] = useState<RetailMilestone[]>([])
  const [invoiceCategories, setInvoiceCategories] = useState<InvoiceCategory[]>([])
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadInitialData = async () => {
    try {
      const data = await fetchRetailInvoiceInitialData()
      setCompanies(data.companies)
      setProjects(data.projects)
      setInvoiceCategories(data.invoiceCategories)
      setRefunds(data.refunds)
    } catch (err) {
      console.error('Error loading initial data:', err)
      setError('Greška pri učitavanju podataka')
    }
  }

  const loadSuppliers = async () => {
    try {
      setSuppliers(await fetchRetailSuppliers())
    } catch (err) {
      console.error('Error loading suppliers:', err)
    }
  }

  const loadCustomers = async () => {
    try {
      setCustomers(await fetchRetailCustomers())
    } catch (err) {
      console.error('Error loading customers:', err)
    }
  }

  const loadContracts = async () => {
    try {
      const data = await fetchRetailContracts(
        formData.retail_project_id,
        formData.entity_type,
        formData.entity_id,
      )
      setContracts(data)
    } catch (err) {
      console.error('Error loading contracts:', err)
      setError('Greška pri učitavanju ugovora')
    }
  }

  const loadMilestones = async () => {
    try {
      setMilestones(await fetchRetailMilestones(formData.retail_contract_id))
    } catch (err) {
      console.error('Error loading milestones:', err)
      setError('Greška pri učitavanju milestones')
    }
  }

  useEffect(() => {
    loadInitialData()
    loadSuppliers()
    loadCustomers()
  }, [])

  useEffect(() => {
    if (formData.entity_type === 'supplier') {
      loadSuppliers()
    } else {
      loadCustomers()
    }
  }, [formData.entity_type])

  useEffect(() => {
    if (formData.retail_project_id && formData.entity_id) {
      loadContracts()
    } else {
      setContracts([])
    }
  }, [formData.retail_project_id, formData.entity_id, formData.entity_type])

  useEffect(() => {
    if (formData.retail_contract_id) {
      loadMilestones()
    } else {
      setMilestones([])
    }
  }, [formData.retail_contract_id])

  return {
    companies,
    suppliers,
    customers,
    projects,
    contracts,
    milestones,
    invoiceCategories,
    refunds,
    error,
    setError
  }
}
