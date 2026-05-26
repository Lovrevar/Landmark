import { useState, useEffect } from 'react'
import {
  fetchLandPurchaseCompanies,
  fetchLandPurchaseSuppliers,
  fetchLandPurchaseProjects,
  fetchLandPurchasePhases,
  fetchLandPurchaseContracts,
  type Company,
  type Supplier,
  type Project,
  type Phase,
  type Contract,
} from '../services/landPurchaseFormDataService'

export type { Contract }

interface UseLandPurchaseFormDataResult {
  companies: Company[]
  suppliers: Supplier[]
  projects: Project[]
  phases: Phase[]
  availableContracts: Contract[]
}

export function useLandPurchaseFormData(
  invoiceType: 'projects' | 'retail',
  supplierId: string | null,
  projectId: string | null,
  phaseId: string | null,
  isOpen: boolean
): UseLandPurchaseFormDataResult {
  const [companies, setCompanies] = useState<Company[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [availableContracts, setAvailableContracts] = useState<Contract[]>([])

  useEffect(() => {
    if (!isOpen) return
    fetchLandPurchaseCompanies().then(setCompanies)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setSuppliers([])
    setProjects([])
    setPhases([])
    setAvailableContracts([])
    fetchLandPurchaseSuppliers(invoiceType).then(setSuppliers)
  }, [invoiceType, isOpen])

  useEffect(() => {
    if (!supplierId) {
      setProjects([])
      return
    }
    fetchLandPurchaseProjects(invoiceType, supplierId).then(setProjects)
  }, [supplierId, invoiceType])

  useEffect(() => {
    if (!supplierId || !projectId) {
      setPhases([])
      return
    }
    fetchLandPurchasePhases(invoiceType, supplierId, projectId).then(setPhases)
  }, [supplierId, projectId, invoiceType])

  useEffect(() => {
    if (!supplierId || !projectId || !phaseId) {
      setAvailableContracts([])
      return
    }
    fetchLandPurchaseContracts(invoiceType, supplierId, projectId, phaseId).then(setAvailableContracts)
  }, [supplierId, projectId, phaseId, invoiceType])

  return { companies, suppliers, projects, phases, availableContracts }
}
