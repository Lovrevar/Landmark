import { supabase } from '../../../../lib/supabase'

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

export interface BankeCreditsData {
  banks: BankeBank[]
  credits: BankeCredit[]
  allocations: Map<string, BankeCreditAllocation[]>
  disbursedAmounts: Map<string, number>
}

async function fetchBanks(): Promise<BankeBank[]> {
  const { data, error } = await supabase
    .from('banks')
    .select('id, name, contact_person, contact_email')
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

async function fetchCredits(): Promise<BankeCredit[]> {
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
  return data || []
}

async function fetchDisbursedAmounts(creditIds: string[]): Promise<Map<string, number>> {
  if (creditIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('accounting_invoices')
    .select('bank_credit_id, total_amount, credit_allocation_id')
    .eq('invoice_type', 'OUTGOING_BANK')
    .in('bank_credit_id', creditIds)

  if (error) throw error

  const map = new Map<string, number>()
  for (const row of data || []) {
    if (!row.bank_credit_id) continue
    if (!row.credit_allocation_id) {
      map.set(row.bank_credit_id, (map.get(row.bank_credit_id) || 0) + Number(row.total_amount))
    }
  }
  return map
}

async function fetchAllocationsByCredits(creditIds: string[]): Promise<Map<string, BankeCreditAllocation[]>> {
  const result = new Map<string, BankeCreditAllocation[]>()
  for (const id of creditIds) result.set(id, [])
  if (creditIds.length === 0) return result

  const { data, error } = await supabase
    .from('credit_allocations')
    .select(`*, project:projects(id, name)`)
    .in('credit_id', creditIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  const allocations = data || []
  if (allocations.length === 0) return result

  const refinancing = allocations.filter(a => a.allocation_type === 'refinancing' && a.refinancing_entity_id)
  const companyIds = refinancing.filter(a => a.refinancing_entity_type === 'company').map(a => a.refinancing_entity_id as string)
  const bankIds = refinancing.filter(a => a.refinancing_entity_type === 'bank').map(a => a.refinancing_entity_id as string)

  const [companiesRes, banksRes] = await Promise.all([
    companyIds.length > 0
      ? supabase.from('accounting_companies').select('id, name').in('id', companyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    bankIds.length > 0
      ? supabase.from('banks').select('id, name').in('id', bankIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const companyById = new Map((companiesRes.data || []).map(c => [c.id, c]))
  const bankById = new Map((banksRes.data || []).map(b => [b.id, b]))

  for (const allocation of allocations) {
    let enriched = allocation
    if (allocation.allocation_type === 'refinancing' && allocation.refinancing_entity_id) {
      if (allocation.refinancing_entity_type === 'company') {
        enriched = { ...allocation, refinancing_company: companyById.get(allocation.refinancing_entity_id) || null }
      } else if (allocation.refinancing_entity_type === 'bank') {
        enriched = { ...allocation, refinancing_bank: bankById.get(allocation.refinancing_entity_id) || null }
      }
    }
    const arr = result.get(allocation.credit_id) || []
    arr.push(enriched as BankeCreditAllocation)
    result.set(allocation.credit_id, arr)
  }

  return result
}

export async function fetchBankeCreditsData(): Promise<BankeCreditsData> {
  const [banks, credits] = await Promise.all([fetchBanks(), fetchCredits()])

  const creditIds = credits.map((c) => c.id)
  const [allocations, disbursedAmounts] = await Promise.all([
    fetchAllocationsByCredits(creditIds),
    fetchDisbursedAmounts(creditIds),
  ])

  return { banks, credits, allocations, disbursedAmounts }
}
