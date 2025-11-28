import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  CreditCard,
  AlertCircle,
  Wallet,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfYear, subMonths } from 'date-fns'

interface VATStats {
  totalVATCollected: number // VAT from outgoing invoices
  totalVATPaid: number // VAT from incoming invoices
  netVAT: number // To pay or receive from tax office
  currentMonthVATCollected: number
  currentMonthVATPaid: number
}

interface CashFlowStats {
  totalIncoming: number // All payments received
  totalOutgoing: number // All payments made
  netCashFlow: number
  currentMonthIncoming: number
  currentMonthOutgoing: number
  previousMonthIncoming: number
  previousMonthOutgoing: number
}

interface TopCompany {
  id: string
  name: string
  totalIncoming: number
  totalOutgoing: number
  netBalance: number
  invoiceCount: number
}

interface BankAccountStats {
  id: string
  bank_name: string
  account_number: string
  current_balance: number
  total_incoming: number
  total_outgoing: number
  transaction_count: number
}

interface MonthlyData {
  month: string
  incoming: number
  outgoing: number
}

const AccountingDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [vatStats, setVatStats] = useState<VATStats>({
    totalVATCollected: 0,
    totalVATPaid: 0,
    netVAT: 0,
    currentMonthVATCollected: 0,
    currentMonthVATPaid: 0
  })
  const [cashFlowStats, setCashFlowStats] = useState<CashFlowStats>({
    totalIncoming: 0,
    totalOutgoing: 0,
    netCashFlow: 0,
    currentMonthIncoming: 0,
    currentMonthOutgoing: 0,
    previousMonthIncoming: 0,
    previousMonthOutgoing: 0
  })
  const [topCompanies, setTopCompanies] = useState<TopCompany[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountStats[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchVATStats(),
        fetchCashFlowStats(),
        fetchTopCompanies(),
        fetchBankAccountStats(),
        fetchMonthlyTrends()
      ])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchVATStats = async () => {
    try {
      const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const currentMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

      // Fetch all invoices with VAT
      const { data: invoices, error } = await supabase
        .from('accounting_invoices')
        .select('invoice_type, vat_amount, issue_date')

      if (error) throw error

      const outgoingInvoices = invoices?.filter(inv =>
        inv.invoice_type.startsWith('OUTGOING')
      ) || []

      const incomingInvoices = invoices?.filter(inv =>
        inv.invoice_type.startsWith('INCOMING') &&
        inv.invoice_type !== 'INCOMING_INVESTOR' &&
        inv.invoice_type !== 'INCOMING_BANK_CREDIT'
      ) || []

      const totalVATCollected = outgoingInvoices.reduce((sum, inv) => sum + parseFloat(inv.vat_amount || 0), 0)
      const totalVATPaid = incomingInvoices.reduce((sum, inv) => sum + parseFloat(inv.vat_amount || 0), 0)

      const currentMonthVATCollected = outgoingInvoices
        .filter(inv => inv.issue_date >= currentMonthStart && inv.issue_date <= currentMonthEnd)
        .reduce((sum, inv) => sum + parseFloat(inv.vat_amount || 0), 0)

      const currentMonthVATPaid = incomingInvoices
        .filter(inv => inv.issue_date >= currentMonthStart && inv.issue_date <= currentMonthEnd)
        .reduce((sum, inv) => sum + parseFloat(inv.vat_amount || 0), 0)

      setVatStats({
        totalVATCollected,
        totalVATPaid,
        netVAT: totalVATCollected - totalVATPaid,
        currentMonthVATCollected,
        currentMonthVATPaid
      })
    } catch (error) {
      console.error('Error fetching VAT stats:', error)
    }
  }

  const fetchCashFlowStats = async () => {
    try {
      const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const currentMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
      const previousMonthStart = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
      const previousMonthEnd = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')

      // Fetch all payments
      const { data: payments, error } = await supabase
        .from('accounting_payments')
        .select(`
          amount,
          payment_date,
          invoice_id,
          accounting_invoices!inner(invoice_type)
        `)

      if (error) throw error

      const incomingPayments = payments?.filter(p => {
        const invoiceType = (p.accounting_invoices as any).invoice_type
        return invoiceType.startsWith('OUTGOING') ||
               invoiceType === 'INCOMING_BANK_CREDIT' ||
               invoiceType === 'INCOMING_INVESTOR'
      }) || []

      const outgoingPayments = payments?.filter(p => {
        const invoiceType = (p.accounting_invoices as any).invoice_type
        return invoiceType.startsWith('INCOMING') &&
               invoiceType !== 'INCOMING_BANK_CREDIT' &&
               invoiceType !== 'INCOMING_INVESTOR'
      }) || []

      const totalIncoming = incomingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
      const totalOutgoing = outgoingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)

      const currentMonthIncoming = incomingPayments
        .filter(p => p.payment_date >= currentMonthStart && p.payment_date <= currentMonthEnd)
        .reduce((sum, p) => sum + parseFloat(p.amount), 0)

      const currentMonthOutgoing = outgoingPayments
        .filter(p => p.payment_date >= currentMonthStart && p.payment_date <= currentMonthEnd)
        .reduce((sum, p) => sum + parseFloat(p.amount), 0)

      const previousMonthIncoming = incomingPayments
        .filter(p => p.payment_date >= previousMonthStart && p.payment_date <= previousMonthEnd)
        .reduce((sum, p) => sum + parseFloat(p.amount), 0)

      const previousMonthOutgoing = outgoingPayments
        .filter(p => p.payment_date >= previousMonthStart && p.payment_date <= previousMonthEnd)
        .reduce((sum, p) => sum + parseFloat(p.amount), 0)

      setCashFlowStats({
        totalIncoming,
        totalOutgoing,
        netCashFlow: totalIncoming - totalOutgoing,
        currentMonthIncoming,
        currentMonthOutgoing,
        previousMonthIncoming,
        previousMonthOutgoing
      })
    } catch (error) {
      console.error('Error fetching cash flow stats:', error)
    }
  }

  const fetchTopCompanies = async () => {
    try {
      // Fetch all companies with their invoices and payments
      const { data: companies, error } = await supabase
        .from('accounting_companies')
        .select('id, name')

      if (error) throw error

      const companyStats: TopCompany[] = []

      for (const company of companies || []) {
        // Get all bank accounts for this company
        const { data: bankAccounts } = await supabase
          .from('company_bank_accounts')
          .select('current_balance')
          .eq('company_id', company.id)

        // Get all payments for this company's invoices
        const { data: payments } = await supabase
          .from('accounting_payments')
          .select(`
            amount,
            accounting_invoices!inner(invoice_type, company_id)
          `)
          .eq('accounting_invoices.company_id', company.id)

        // Calculate incoming (money received) and outgoing (money paid)
        const incomingPayments = payments?.filter(p => {
          const invoiceType = (p.accounting_invoices as any).invoice_type
          return invoiceType.startsWith('OUTGOING') ||
                 invoiceType === 'INCOMING_BANK_CREDIT' ||
                 invoiceType === 'INCOMING_INVESTOR'
        }) || []

        const outgoingPayments = payments?.filter(p => {
          const invoiceType = (p.accounting_invoices as any).invoice_type
          return invoiceType.startsWith('INCOMING') &&
                 invoiceType !== 'INCOMING_BANK_CREDIT' &&
                 invoiceType !== 'INCOMING_INVESTOR'
        }) || []

        const totalIncoming = incomingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
        const totalOutgoing = outgoingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)

        const totalBalance = bankAccounts?.reduce((sum, acc) =>
          sum + parseFloat(acc.current_balance || '0'), 0
        ) || 0

        // Get invoice count
        const { count: invoiceCount } = await supabase
          .from('accounting_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id)

        companyStats.push({
          id: company.id,
          name: company.name,
          totalIncoming,
          totalOutgoing,
          netBalance: totalBalance,
          invoiceCount: invoiceCount || 0
        })
      }

      // Sort by net balance (most profitable first)
      companyStats.sort((a, b) => b.netBalance - a.netBalance)
      setTopCompanies(companyStats.slice(0, 5))
    } catch (error) {
      console.error('Error fetching top companies:', error)
    }
  }

  const fetchBankAccountStats = async () => {
    try {
      const { data: accounts, error } = await supabase
        .from('company_bank_accounts')
        .select('id, bank_name, account_number, current_balance')

      if (error) throw error

      const accountStats: BankAccountStats[] = []

      for (const account of accounts || []) {
        // Get all payments through this account
        const { data: payments } = await supabase
          .from('accounting_payments')
          .select(`
            amount,
            accounting_invoices!inner(invoice_type)
          `)
          .eq('company_bank_account_id', account.id)

        const incomingPayments = payments?.filter(p =>
          (p.accounting_invoices as any).invoice_type === 'OUTGOING_SALES' ||
          (p.accounting_invoices as any).invoice_type === 'INCOMING_BANK_CREDIT' ||
          (p.accounting_invoices as any).invoice_type === 'INCOMING_INVESTOR'
        ) || []

        const outgoingPayments = payments?.filter(p =>
          (p.accounting_invoices as any).invoice_type === 'INCOMING_SUBCONTRACTOR' ||
          (p.accounting_invoices as any).invoice_type === 'INCOMING_OFFICE' ||
          (p.accounting_invoices as any).invoice_type === 'OUTGOING_SUBCONTRACTOR' ||
          (p.accounting_invoices as any).invoice_type === 'OUTGOING_OFFICE'
        ) || []

        const total_incoming = incomingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
        const total_outgoing = outgoingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)

        accountStats.push({
          id: account.id,
          bank_name: account.bank_name,
          account_number: account.account_number,
          current_balance: parseFloat(account.current_balance || 0),
          total_incoming,
          total_outgoing,
          transaction_count: (payments || []).length
        })
      }

      // Sort by current balance (highest first)
      accountStats.sort((a, b) => b.current_balance - a.current_balance)
      setBankAccounts(accountStats)
    } catch (error) {
      console.error('Error fetching bank account stats:', error)
    }
  }

  const fetchMonthlyTrends = async () => {
    try {
      const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd')

      const { data: payments, error } = await supabase
        .from('accounting_payments')
        .select(`
          amount,
          payment_date,
          accounting_invoices!inner(invoice_type)
        `)
        .gte('payment_date', yearStart)

      if (error) throw error

      const monthlyMap = new Map<string, { incoming: number; outgoing: number }>()

      for (const payment of payments || []) {
        const month = format(new Date(payment.payment_date), 'MMM yyyy')
        const invoiceType = (payment.accounting_invoices as any).invoice_type

        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { incoming: 0, outgoing: 0 })
        }

        const data = monthlyMap.get(month)!
        const amount = parseFloat(payment.amount)

        if (invoiceType === 'OUTGOING_SALES' ||
            invoiceType === 'INCOMING_BANK_CREDIT' ||
            invoiceType === 'INCOMING_INVESTOR') {
          data.incoming += amount
        } else {
          data.outgoing += amount
        }
      }

      const monthlyArray: MonthlyData[] = Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        incoming: data.incoming,
        outgoing: data.outgoing
      }))

      setMonthlyData(monthlyArray)
    } catch (error) {
      console.error('Error fetching monthly trends:', error)
    }
  }

  const calculateChangePercentage = (current: number, previous: number): number => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  const incomingChange = calculateChangePercentage(
    cashFlowStats.currentMonthIncoming,
    cashFlowStats.previousMonthIncoming
  )

  const outgoingChange = calculateChangePercentage(
    cashFlowStats.currentMonthOutgoing,
    cashFlowStats.previousMonthOutgoing
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading accounting dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounting Dashboard</h1>
          <p className="text-gray-600 mt-1">Comprehensive financial overview and insights</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Current Period</p>
          <p className="text-lg font-semibold text-gray-900">
            {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>
      </div>

      {/* VAT Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center mb-4">
          <PieChart className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">PDV Overview</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">PDV Collected (Total)</p>
            <p className="text-2xl font-bold text-green-600">
              €{vatStats.totalVATCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              This month: €{vatStats.currentMonthVATCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">PDV Paid (Total)</p>
            <p className="text-2xl font-bold text-red-600">
              €{vatStats.totalVATPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              This month: €{vatStats.currentMonthVATPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Net PDV Position</p>
            <p className={`text-2xl font-bold ${vatStats.netVAT >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{Math.abs(vatStats.netVAT).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {vatStats.netVAT >= 0 ? 'To pay to tax office' : 'To receive from tax office'}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Current Month Net PDV</p>
            <p className={`text-2xl font-bold ${
              (vatStats.currentMonthVATCollected - vatStats.currentMonthVATPaid) >= 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}>
              €{Math.abs(vatStats.currentMonthVATCollected - vatStats.currentMonthVATPaid).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {(vatStats.currentMonthVATCollected - vatStats.currentMonthVATPaid) >= 0
                ? 'To pay'
                : 'To receive'}
            </p>
          </div>
        </div>
      </div>

      {/* Cash Flow Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Total Incoming</p>
                <p className="text-2xl font-bold text-gray-900">
                  €{cashFlowStats.totalIncoming.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">This Month:</span>
            <div className="flex items-center">
              <span className="font-semibold text-gray-900 mr-2">
                €{cashFlowStats.currentMonthIncoming.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {incomingChange !== 0 && (
                <span className={`flex items-center ${incomingChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {incomingChange > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {Math.abs(incomingChange).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Total Outgoing</p>
                <p className="text-2xl font-bold text-gray-900">
                  €{cashFlowStats.totalOutgoing.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">This Month:</span>
            <div className="flex items-center">
              <span className="font-semibold text-gray-900 mr-2">
                €{cashFlowStats.currentMonthOutgoing.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {outgoingChange !== 0 && (
                <span className={`flex items-center ${outgoingChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {outgoingChange > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {Math.abs(outgoingChange).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${cashFlowStats.netCashFlow >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                <DollarSign className={`w-6 h-6 ${cashFlowStats.netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Net Cash Flow</p>
                <p className={`text-2xl font-bold ${cashFlowStats.netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  €{Math.abs(cashFlowStats.netCashFlow).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">This Month:</span>
            <span className={`font-semibold ${
              (cashFlowStats.currentMonthIncoming - cashFlowStats.currentMonthOutgoing) >= 0
                ? 'text-blue-600'
                : 'text-orange-600'
            }`}>
              €{Math.abs(cashFlowStats.currentMonthIncoming - cashFlowStats.currentMonthOutgoing).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Top Companies and Bank Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Companies */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <Building2 className="w-5 h-5 text-gray-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Top 5 Companies by Net Balance</h2>
            </div>
          </div>
          <div className="p-6">
            {topCompanies.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No company data available</p>
            ) : (
              <div className="space-y-4">
                {topCompanies.map((company, index) => (
                  <div key={company.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mr-3 ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{company.name}</p>
                        <p className="text-xs text-gray-500">{company.invoiceCount} invoices</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${company.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        €{Math.abs(company.netBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500">
                        In: €{company.totalIncoming.toLocaleString()} | Out: €{company.totalOutgoing.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bank Accounts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <Wallet className="w-5 h-5 text-gray-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Bank Accounts Performance</h2>
            </div>
          </div>
          <div className="p-6">
            {bankAccounts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No bank account data available</p>
            ) : (
              <div className="space-y-4">
                {bankAccounts.map((account) => (
                  <div key={account.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <CreditCard className="w-5 h-5 text-blue-600 mr-2" />
                        <div>
                          <p className="font-semibold text-gray-900">{account.bank_name}</p>
                          <p className="text-xs text-gray-500">{account.account_number}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">
                          €{account.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500">{account.transaction_count} transactions</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                      <span className="flex items-center">
                        <ArrowUpRight className="w-3 h-3 text-green-600 mr-1" />
                        In: €{account.total_incoming.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="flex items-center">
                        <ArrowDownRight className="w-3 h-3 text-red-600 mr-1" />
                        Out: €{account.total_outgoing.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Trends */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-gray-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Monthly Cash Flow Trends ({new Date().getFullYear()})</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {monthlyData.map((data) => (
                <div key={data.month} className="flex items-center">
                  <div className="w-24 text-sm font-medium text-gray-700">{data.month}</div>
                  <div className="flex-1 flex items-center space-x-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-green-500 flex items-center justify-end pr-2"
                        style={{
                          width: `${Math.min((data.incoming / Math.max(data.incoming, data.outgoing, 1)) * 100, 100)}%`
                        }}
                      >
                        <span className="text-xs font-semibold text-white">
                          €{data.incoming.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-red-500 flex items-center justify-end pr-2"
                        style={{
                          width: `${Math.min((data.outgoing / Math.max(data.incoming, data.outgoing, 1)) * 100, 100)}%`
                        }}
                      >
                        <span className="text-xs font-semibold text-white">
                          €{data.outgoing.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`w-32 text-right text-sm font-semibold ${
                    (data.incoming - data.outgoing) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(data.incoming - data.outgoing) >= 0 ? '+' : '-'}
                    €{Math.abs(data.incoming - data.outgoing).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center space-x-6 mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                <span className="text-sm text-gray-600">Incoming</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                <span className="text-sm text-gray-600">Outgoing</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountingDashboard
