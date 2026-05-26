import { supabase } from '../../../../lib/supabase'

export interface CreditAllocation {
  id: string
  allocated_amount: number
  used_amount: number
  description: string | null
  bank_credit: {
    id: string
    credit_name: string
    amount: number
    used_amount: number
    repaid_amount: number
    outstanding_balance: number
    interest_rate: number
    disbursed_to_account?: boolean
    company: { id: string; name: string }
  }
}

export const fetchCreditAllocations = async (projectId: string): Promise<CreditAllocation[]> => {
  const { data, error } = await supabase
    .from('credit_allocations')
    .select(`
      id,
      allocated_amount,
      used_amount,
      description,
      bank_credit:bank_credits!credit_allocations_credit_id_fkey(
        id,
        credit_name,
        amount,
        used_amount,
        repaid_amount,
        outstanding_balance,
        interest_rate,
        disbursed_to_account,
        company:accounting_companies(id, name)
      )
    `)
    .eq('project_id', projectId)

  if (error) throw error
  return (data || []) as unknown as CreditAllocation[]
}

export const fetchProjectFunders = async (projectId: string) => {
  const { data, error } = await supabase
    .from('credit_allocations')
    .select('bank_credits(bank_id, banks(id, name))')
    .eq('project_id', projectId)

  if (error) throw error

  const banks = Array.from(
    new Map(
      (data || [])
        .filter(alloc => (alloc.bank_credits as unknown as { banks?: { id: string; name: string } } | null)?.banks)
        .map(alloc => {
          const bc = alloc.bank_credits as unknown as { banks: { id: string; name: string } }
          return [bc.banks.id, bc.banks]
        })
    ).values()
  )

  return { banks }
}

export const fetchBankById = async (bankId: string): Promise<string | null> => {
  const { data, error } = await supabase.from('banks').select('name').eq('id', bankId).maybeSingle()
  if (error) throw error
  return data?.name || null
}
