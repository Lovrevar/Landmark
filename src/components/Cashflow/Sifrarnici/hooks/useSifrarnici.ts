import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AccountMapping,
  AccountRow,
  CostCenterMapping,
  CostCenterRow,
  PartnerEntityKind,
  PartnerMapping,
  PartnerRow,
  SifrarnikTab,
  TargetOption,
} from '../types'
import {
  deleteAccountMapping,
  deleteCostCenterMapping,
  deletePartnerMapping,
  fetchAccountRows,
  fetchBanks,
  fetchCostCenterRows,
  fetchInvoiceCategories,
  fetchPartnerRows,
  fetchPartnerTargets,
  fetchProjectTargets,
  saveAccountMapping,
  saveCostCenterMapping,
  savePartnerMapping,
} from '../services/sifrarniciService'

export function useSifrarnici() {
  const [activeTab, setActiveTab] = useState<SifrarnikTab>('accounts')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [onlyUnmapped, setOnlyUnmapped] = useState(false)

  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [partners, setPartners] = useState<PartnerRow[]>([])

  const [categories, setCategories] = useState<TargetOption[]>([])
  const [banks, setBanks] = useState<TargetOption[]>([])
  const [projects, setProjects] = useState<TargetOption[]>([])
  const [retailProjects, setRetailProjects] = useState<TargetOption[]>([])

  // Partner targets are fetched per entity kind on demand — loading all seven
  // tables up front would pull the whole customer list for nothing.
  const [partnerTargets, setPartnerTargets] = useState<Partial<Record<PartnerEntityKind, TargetOption[]>>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [acc, cc, pt, cats, bnk, projs] = await Promise.all([
        fetchAccountRows(),
        fetchCostCenterRows(),
        fetchPartnerRows(),
        fetchInvoiceCategories(),
        fetchBanks(),
        fetchProjectTargets(),
      ])
      setAccounts(acc)
      setCostCenters(cc)
      setPartners(pt)
      setCategories(cats)
      setBanks(bnk)
      setProjects(projs.projects)
      setRetailProjects(projs.retailProjects)
    } catch (e) {
      console.error('Error loading šifrarnici:', e)
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const ensurePartnerTargets = useCallback(async (kind: PartnerEntityKind) => {
    if (partnerTargets[kind]) return
    try {
      const opts = await fetchPartnerTargets(kind)
      setPartnerTargets(prev => ({ ...prev, [kind]: opts }))
    } catch (e) {
      console.error(`Error loading targets for ${kind}:`, e)
    }
  }, [partnerTargets])

  // --- filtering -----------------------------------------------------------

  const matches = useCallback((haystack: string[]) => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    return haystack.some(h => h?.toLowerCase().includes(q))
  }, [searchTerm])

  const filteredAccounts = useMemo(
    () => accounts.filter(a =>
      matches([a.account_code, a.name]) &&
      (!onlyUnmapped || !a.mapping || a.mapping.role === 'unclassified')),
    [accounts, matches, onlyUnmapped],
  )

  const filteredCostCenters = useMemo(
    () => costCenters.filter(c => matches([c.code, c.name]) && (!onlyUnmapped || !c.mapping)),
    [costCenters, matches, onlyUnmapped],
  )

  const filteredPartners = useMemo(
    () => partners.filter(p =>
      matches([String(p.kom_id), p.name, p.oib ?? '']) && (!onlyUnmapped || !p.mapping)),
    [partners, matches, onlyUnmapped],
  )

  const unmappedCounts = useMemo(() => ({
    accounts: accounts.filter(a => !a.mapping || a.mapping.role === 'unclassified').length,
    cost_centers: costCenters.filter(c => !c.mapping).length,
    partners: partners.filter(p => !p.mapping).length,
  }), [accounts, costCenters, partners])

  // --- writes --------------------------------------------------------------
  // Each saves, then reloads only the affected list, so an edit does not
  // re-fetch every code list on the page.

  const saveAccount = useCallback(async (mapping: AccountMapping) => {
    await saveAccountMapping(mapping)
    setAccounts(await fetchAccountRows())
  }, [])

  const saveCostCenter = useCallback(async (mapping: CostCenterMapping) => {
    await saveCostCenterMapping(mapping)
    setCostCenters(await fetchCostCenterRows())
  }, [])

  const savePartner = useCallback(async (mapping: PartnerMapping) => {
    await savePartnerMapping(mapping)
    setPartners(await fetchPartnerRows())
  }, [])

  const clearAccount = useCallback(async (code: string) => {
    await deleteAccountMapping(code)
    setAccounts(await fetchAccountRows())
  }, [])

  const clearCostCenter = useCallback(async (code: string) => {
    await deleteCostCenterMapping(code)
    setCostCenters(await fetchCostCenterRows())
  }, [])

  const clearPartner = useCallback(async (komId: number) => {
    await deletePartnerMapping(komId)
    setPartners(await fetchPartnerRows())
  }, [])

  return {
    activeTab, setActiveTab,
    loading, error,
    searchTerm, setSearchTerm,
    onlyUnmapped, setOnlyUnmapped,
    accounts, costCenters, partners,
    filteredAccounts, filteredCostCenters, filteredPartners,
    unmappedCounts,
    categories, banks, projects, retailProjects,
    partnerTargets, ensurePartnerTargets,
    saveAccount, saveCostCenter, savePartner,
    clearAccount, clearCostCenter, clearPartner,
    reload: load,
  }
}
