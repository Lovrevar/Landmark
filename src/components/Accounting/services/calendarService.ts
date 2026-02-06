import { supabase } from '../../../lib/supabase'
import { Invoice, MonthlyBudget } from '../types/calendarTypes'

export const fetchInvoices = async (): Promise<Invoice[]> => {
  try {
    const { data, error } = await supabase
      .from('accounting_invoices')
      .select(`
        *,
        company:accounting_companies!accounting_invoices_company_id_fkey(name),
        supplier:subcontractors(name),
        customer:customers(name),
        office_supplier:office_suppliers(name),
        bank_company:bank_id(name)
      `)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return []
  }
}

export const fetchBudgets = async (): Promise<MonthlyBudget[]> => {
  try {
    const { data, error } = await supabase
      .from('monthly_budgets')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return []
  }
}

export const handleSaveBudgets = async (
  budgetYear: number,
  budgetFormData: { [key: number]: number },
  budgets: MonthlyBudget[]
): Promise<void> => {
  try {
    for (let m = 1; m <= 12; m++) {
      const amount = budgetFormData[m] || 0
      const existing = budgets.find(b => b.year === budgetYear && b.month === m)

      if (existing) {
        await supabase
          .from('monthly_budgets')
          .update({ budget_amount: amount })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('monthly_budgets')
          .insert({
            year: budgetYear,
            month: m,
            budget_amount: amount,
            notes: ''
          })
      }
    }
  } catch (error) {
    console.error('Error saving budgets:', error)
    throw error
  }
}
