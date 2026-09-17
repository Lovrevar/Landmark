import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      setError(t('invoices.retail.error_load'))
    }
  }

  // An empty supplier or customer dropdown is indistinguishable from a failed query, and the
  // form silently refuses to save without one — so say which it is.
  const loadSuppliers = async () => {
    try {
      setSuppliers(await fetchRetailSuppliers())
    } catch (err) {
      console.error('Error loading suppliers:', err)
      setError(t('invoices.retail.error_load_entities'))
    }
  }

  const loadCustomers = async () => {
    try {
      setCustomers(await fetchRetailCustomers())
    } catch (err) {
      console.error('Error loading customers:', err)
      setError(t('invoices.retail.error_load_entities'))
    }
  }

  const loadContracts = useCallback(async () => {
    try {
      const data = await fetchRetailContracts(
        formData.retail_project_id,
        formData.entity_type,
        formData.entity_id,
      )
      setContracts(data)
    } catch (err) {
      console.error('Error loading contracts:', err)
      setError(t('invoices.retail.error_load_contracts'))
    }
  }, [formData.retail_project_id, formData.entity_type, formData.entity_id, t])

  const loadMilestones = useCallback(async () => {
    try {
      setMilestones(await fetchRetailMilestones(formData.retail_contract_id))
    } catch (err) {
      console.error('Error loading milestones:', err)
      setError(t('invoices.retail.error_load_milestones'))
    }
  }, [formData.retail_contract_id, t])

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
  }, [formData.retail_project_id, formData.entity_id, formData.entity_type, loadContracts])

  useEffect(() => {
    if (formData.retail_contract_id) {
      loadMilestones()
    } else {
      setMilestones([])
    }
  }, [formData.retail_contract_id, loadMilestones])

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
