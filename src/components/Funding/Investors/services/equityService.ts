import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { format } from 'date-fns'
import type { EquityFormData } from '../types'

export async function createEquityInvestment(equity: EquityFormData): Promise<void> {
  const { error } = await supabase
    .from('bank_credits')
    .insert({
      bank_id: equity.bank_id,
      company_id: equity.company_id || null,
      project_id: null,
      credit_name: `Equity Investment ${format(new Date(equity.investment_date), 'MMM yyyy')}`,
      credit_type: 'equity',
      credit_seniority: 'junior',
      amount: equity.amount,
      interest_rate: equity.expected_return,
      start_date: equity.investment_date,
      maturity_date: equity.maturity_date || null,
      usage_expiration_date: equity.usage_expiration_date || null,
      outstanding_balance: equity.amount,
      status: 'active',
      purpose: equity.terms || null,
      grace_period: equity.grace_period || 0,
      repayment_type: equity.payment_schedule === 'monthly' ? 'monthly' : 'yearly',
      principal_repayment_type: equity.payment_schedule === 'monthly' ? 'monthly' : 'yearly',
      interest_repayment_type: equity.payment_schedule === 'monthly' ? 'monthly' : 'yearly',
      monthly_payment: 0,
    })

  if (error) throw error

  logActivity({
    action: 'equity_investment.create',
    entity: 'equity_investment',
    metadata: { severity: 'high', amount: equity.amount },
  })
}
