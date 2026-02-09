import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
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
} from '../types/retailInvoiceTypes'

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
      const [companiesRes, projectsRes, categoriesRes, refundsRes] = await Promise.all([
        supabase.from('accounting_companies').select('id, name').order('name'),
        supabase.from('retail_projects').select('id, name, plot_number').order('name'),
        supabase.from('invoice_categories').select('id, name').eq('is_active', true).order('sort_order'),
        supabase.from('accounting_invoices_refund').select('id, name').order('name')
      ])

      if (companiesRes.error) throw companiesRes.error
      if (projectsRes.error) throw projectsRes.error

      setCompanies(companiesRes.data || [])
      setProjects(projectsRes.data || [])
      if (!categoriesRes.error) {
        setInvoiceCategories(categoriesRes.data || [])
      }
      if (!refundsRes.error) {
        setRefunds(refundsRes.data || [])
      }
    } catch (err) {
      console.error('Error loading initial data:', err)
      setError('Greška pri učitavanju podataka')
    }
  }

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('retail_suppliers')
        .select('id, name, contact_person')
        .order('name')

      if (error) throw error
      setSuppliers(data || [])
    } catch (err) {
      console.error('Error loading suppliers:', err)
    }
  }

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('retail_customers')
        .select('id, name, contact_email')
        .order('name')

      if (error) throw error
      setCustomers(data || [])
    } catch (err) {
      console.error('Error loading customers:', err)
    }
  }

  const loadContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('retail_contracts')
        .select(`
          id,
          contract_number,
          phase_id,
          supplier_id,
          customer_id,
          phases:retail_project_phases!inner(phase_type, phase_name, project_id)
        `)
        .eq('retail_project_phases.project_id', formData.retail_project_id)
        .eq(formData.entity_type === 'supplier' ? 'supplier_id' : 'customer_id', formData.entity_id)
        .order('contract_number')

      if (error) throw error
      setContracts(data || [])
    } catch (err) {
      console.error('Error loading contracts:', err)
      setError('Greška pri učitavanju ugovora')
    }
  }

  const loadMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('retail_contract_milestones')
        .select('id, milestone_number, milestone_name, percentage, status, due_date')
        .eq('contract_id', formData.retail_contract_id)
        .order('milestone_number', { ascending: true })

      if (error) throw error
      setMilestones(data || [])
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
