import { useState, useEffect, useCallback } from 'react'
import { toLoadError } from '../../services/loadError'
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
  /** Non-null when one of the dropdown queries failed, so an empty list is not read as
   *  "no contracts for this phase". Every list here gates the save. */
  error: Error | null
  dismissError: () => void
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
  const [error, setError] = useState<Error | null>(null)

  // Each of these was a floating `.then()`: a rejection became an unhandled rejection and an
  // empty dropdown. They report now, and the modal shows it.
  const report = useCallback((context: string) => (e: unknown) => {
    console.error(`Error loading land-purchase ${context}:`, e)
    setError(toLoadError(e))
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    fetchLandPurchaseCompanies().then(setCompanies).catch(report('companies'))
  }, [isOpen, report])

  useEffect(() => {
    if (!isOpen) return
    setSuppliers([])
    setProjects([])
    setPhases([])
    setAvailableContracts([])
    fetchLandPurchaseSuppliers(invoiceType).then(setSuppliers).catch(report('suppliers'))
  }, [invoiceType, isOpen, report])

  useEffect(() => {
    if (!supplierId) {
      setProjects([])
      return
    }
    fetchLandPurchaseProjects(invoiceType, supplierId).then(setProjects).catch(report('projects'))
  }, [supplierId, invoiceType, report])

  useEffect(() => {
    if (!supplierId || !projectId) {
      setPhases([])
      return
    }
    fetchLandPurchasePhases(invoiceType, supplierId, projectId).then(setPhases).catch(report('phases'))
  }, [supplierId, projectId, invoiceType, report])

  useEffect(() => {
    if (!supplierId || !projectId || !phaseId) {
      setAvailableContracts([])
      return
    }
    fetchLandPurchaseContracts(invoiceType, supplierId, projectId, phaseId)
      .then(setAvailableContracts)
      .catch(report('contracts'))
  }, [supplierId, projectId, phaseId, invoiceType, report])

  return {
    companies, suppliers, projects, phases, availableContracts,
    error,
    dismissError: () => setError(null),
  }
}
