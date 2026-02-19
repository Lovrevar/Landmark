import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export interface BankeCredit {
  id: string
  bank_id: string
  project_id: string | null
  company_id: string | null
  credit_name: string
  credit_type: string
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  start_date: string
  maturity_date: string
  usage_expiration_date: string | null
  status: string
  purpose: string
  disbursed_to_account?: boolean
  bank?: { id: string; name: string }
  project?: { id: string; name: string }
  company?: { id: string; name: string }
}

export interface BankeCreditAllocation {
  id: string
  credit_id: string
  project_id: string | null
  allocated_amount: number
  used_amount: number
  description: string | null
  created_at: string
  allocation_type: 'project' | 'opex' | 'refinancing'
  refinancing_entity_type?: 'company' | 'bank' | null
  refinancing_entity_id?: string | null
  project?: { id: string; name: string }
  refinancing_company?: { id: string; name: string }
  refinancing_bank?: { id: string; name: string }
}

export interface BankeBank {
  id: string
  name: string
  contact_person?: string | null
  contact_email?: string | null
}

const useBankeCredits = () => {
  const [banks, setBanks] = useState<BankeBank[]>([])
  const [credits, setCredits] = useState<BankeCredit[]>([])
  const [allocations, setAllocations] = useState<Map<string, BankeCreditAllocation[]>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchBanks(), fetchCredits()])
    } catch (error) {
      console.error('Error fetching cashflow banks data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBanks = async () => {
    const { data, error } = await supabase
      .from('banks')
      .select('id, name, contact_person, contact_email')
      .order('name', { ascending: true })

    if (error) throw error
    setBanks(data || [])
  }

  const fetchCredits = async () => {
    const { data, error } = await supabase
      .from('bank_credits')
      .select(`
        *,
        bank:banks(id, name),
        project:projects(id, name),
        company:accounting_companies(id, name)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    setCredits(data || [])

    if (data) {
      await Promise.all(data.map((c) => fetchAllocationsForCredit(c.id)))
    }
  }

  const fetchAllocationsForCredit = async (creditId: string) => {
    const { data, error } = await supabase
      .from('credit_allocations')
      .select(`*, project:projects(id, name)`)
      .eq('credit_id', creditId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const enriched = await Promise.all(
      (data || []).map(async (allocation) => {
        if (allocation.allocation_type === 'refinancing' && allocation.refinancing_entity_id) {
          if (allocation.refinancing_entity_type === 'company') {
            const { data: company } = await supabase
              .from('accounting_companies')
              .select('id, name')
              .eq('id', allocation.refinancing_entity_id)
              .maybeSingle()
            return { ...allocation, refinancing_company: company }
          } else if (allocation.refinancing_entity_type === 'bank') {
            const { data: bank } = await supabase
              .from('banks')
              .select('id, name')
              .eq('id', allocation.refinancing_entity_id)
              .maybeSingle()
            return { ...allocation, refinancing_bank: bank }
          }
        }
        return allocation
      })
    )

    setAllocations((prev) => {
      const next = new Map(prev)
      next.set(creditId, enriched)
      return next
    })
  }

  const creditsByBank = (bankId: string) =>
    credits.filter((c) => c.bank_id === bankId)

  return { banks, credits, allocations, loading, creditsByBank, refetch: fetchAll }
}

export default useBankeCredits
