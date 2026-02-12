import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { TrendingUp, Building2, ChevronDown, ChevronUp, Plus, Trash2, Users } from 'lucide-react'
import { format } from 'date-fns'
import { PageHeader, LoadingSpinner, StatGrid, Modal, FormField, Input, Select, Textarea, Button, Badge, EmptyState, StatCard } from '../../ui'
import DateInput from '../../Common/DateInput'

interface ProjectInvestment {
  id: string
  project_id: string | null
  investor_id: string | null
  investment_type: string
  amount: number
  percentage_stake: number | null
  expected_return: number | null
  investment_date: string
  maturity_date: string | null
  status: string
  terms: string | null
  disbursed_to_account?: boolean
  disbursed_to_bank_account_id?: string
  investor?: {
    id: string
    name: string
  }
  project?: {
    id: string
    name: string
  }
}

interface Project {
  id: string
  name: string
}

interface Investor {
  id: string
  name: string
}

interface CompanyBankAccount {
  id: string
  company_id: string
  bank_name: string
  account_number: string | null
  current_balance: number
}

interface Company {
  id: string
  name: string
}

const InvestmentsManagement: React.FC = () => {
  const [investments, setInvestments] = useState<ProjectInvestment[]>([])
  const [expandedInvestments, setExpandedInvestments] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showInvestmentModal, setShowInvestmentModal] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [investors, setInvestors] = useState<Investor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  const [newInvestment, setNewInvestment] = useState({
    project_id: '',
    investor_id: '',
    investment_type: 'equity',
    amount: 0,
    percentage_stake: 0,
    expected_return: 0,
    investment_date: new Date().toISOString().split('T')[0],
    maturity_date: '',
    status: 'active',
    terms: '',
    disbursed_to_account: false,
    disbursed_to_bank_account_id: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (newInvestment.project_id && newInvestment.disbursed_to_account) {
      const project = projects.find(p => p.id === newInvestment.project_id)
      if (project) {
        fetchProjectCompanyAndAccounts(newInvestment.project_id)
      }
    } else {
      setCompanyBankAccounts([])
    }
  }, [newInvestment.project_id, newInvestment.disbursed_to_account])

  const fetchProjectCompanyAndAccounts = async (projectId: string) => {
    try {
      setLoadingAccounts(true)

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('company_id')
        .eq('id', projectId)
        .maybeSingle()

      if (projectError) throw projectError
      if (!project?.company_id) {
        setCompanyBankAccounts([])
        return
      }

      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select(`
          id,
          company_id,
          bank_name,
          account_number,
          current_balance
        `)
        .eq('company_id', project.company_id)
        .order('bank_name', { ascending: true })

      if (error) throw error

      setCompanyBankAccounts(data || [])
    } catch (error) {
      console.error('Error fetching company bank accounts:', error)
      setCompanyBankAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchInvestments(), fetchProjects(), fetchInvestors(), fetchCompanies()])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchInvestments = async () => {
    try {
      const { data, error } = await supabase
        .from('project_investments')
        .select(`
          *,
          investor:investors(id, name),
          project:projects(id, name)
        `)
        .order('investment_date', { ascending: false })

      if (error) throw error

      setInvestments(data || [])
    } catch (error) {
      console.error('Error fetching investments:', error)
    }
  }

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error

      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  const fetchInvestors = async () => {
    try {
      const { data, error } = await supabase
        .from('investors')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error

      setInvestors(data || [])
    } catch (error) {
      console.error('Error fetching investors:', error)
    }
  }

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('accounting_companies')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error

      setCompanies(data || [])
    } catch (error) {
      console.error('Error fetching companies:', error)
    }
  }

  const toggleInvestment = (investmentId: string) => {
    setExpandedInvestments(prev => {
      const next = new Set(prev)
      if (next.has(investmentId)) {
        next.delete(investmentId)
      } else {
        next.add(investmentId)
      }
      return next
    })
  }

  const resetInvestmentForm = () => {
    setNewInvestment({
      project_id: '',
      investor_id: '',
      investment_type: 'equity',
      amount: 0,
      percentage_stake: 0,
      expected_return: 0,
      investment_date: new Date().toISOString().split('T')[0],
      maturity_date: '',
      status: 'active',
      terms: '',
      disbursed_to_account: false,
      disbursed_to_bank_account_id: ''
    })
    setCompanyBankAccounts([])
  }

  const addInvestment = async () => {
    try {
      const investmentData: any = {
        project_id: newInvestment.project_id || null,
        investor_id: newInvestment.investor_id || null,
        investment_type: newInvestment.investment_type,
        amount: newInvestment.amount,
        percentage_stake: newInvestment.percentage_stake || null,
        expected_return: newInvestment.expected_return || null,
        investment_date: newInvestment.investment_date,
        maturity_date: newInvestment.maturity_date || null,
        status: newInvestment.status,
        terms: newInvestment.terms || null,
        disbursed_to_account: newInvestment.disbursed_to_account,
        disbursed_to_bank_account_id: newInvestment.disbursed_to_account ? newInvestment.disbursed_to_bank_account_id : null
      }

      const { error } = await supabase
        .from('project_investments')
        .insert([investmentData])

      if (error) throw error

      await fetchInvestments()
      resetInvestmentForm()
      setShowInvestmentModal(false)
    } catch (error: any) {
      console.error('Error adding investment:', error)
      alert('Error adding investment: ' + error.message)
    }
  }

  const deleteInvestment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this investment?')) return

    try {
      const { error } = await supabase
        .from('project_investments')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchInvestments()
    } catch (error: any) {
      console.error('Error deleting investment:', error)
      alert('Error deleting investment: ' + error.message)
    }
  }

  const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.amount), 0)
  const activeInvestments = investments.filter(inv => inv.status === 'active')
  const totalExpectedReturn = investments.reduce((sum, inv) => sum + Number(inv.expected_return || 0), 0)

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funding - Investments"
        subtitle="Manage equity investments and funding sources"
        actions={
          <Button onClick={() => setShowInvestmentModal(true)} icon={Plus}>
            Add Investment
          </Button>
        }
      />

      <StatGrid>
        <StatCard
          title="Total Invested"
          value={`€${totalInvested.toLocaleString('hr-HR')}`}
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          title="Active Investments"
          value={activeInvestments.length.toString()}
          icon={Users}
          trend="neutral"
        />
        <StatCard
          title="Expected Return"
          value={`€${totalExpectedReturn.toLocaleString('hr-HR')}`}
          icon={Building2}
          trend="up"
        />
      </StatGrid>

      {investments.length === 0 ? (
        <EmptyState
          title="No investments yet"
          description="Add your first equity investment to get started"
          action={{
            label: "Add Investment",
            onClick: () => setShowInvestmentModal(true)
          }}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="divide-y divide-gray-200">
            {investments.map((investment) => {
              const isExpanded = expandedInvestments.has(investment.id)

              return (
                <div key={investment.id}>
                  <div
                    onClick={() => toggleInvestment(investment.id)}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-purple-600" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {investment.investor?.name || 'Unknown Investor'}
                            </h3>
                            <Badge variant={investment.status === 'active' ? 'green' : 'gray'}>
                              {investment.status}
                            </Badge>
                            <Badge variant="purple">
                              {investment.investment_type}
                            </Badge>
                            {investment.disbursed_to_account && (
                              <Badge variant="blue">
                                Isplaćeno na račun
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {investment.project?.name || 'No Project'} • {format(new Date(investment.investment_date), 'dd.MM.yyyy')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-600">
                            €{Number(investment.amount).toLocaleString('hr-HR')}
                          </div>
                          {investment.expected_return && (
                            <div className="text-sm text-gray-600">
                              Expected: €{Number(investment.expected_return).toLocaleString('hr-HR')}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteInvestment(investment.id)
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-sm text-gray-600">Percentage Stake</p>
                          <p className="font-semibold text-gray-900">
                            {investment.percentage_stake ? `${investment.percentage_stake}%` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Maturity Date</p>
                          <p className="font-semibold text-gray-900">
                            {investment.maturity_date ? format(new Date(investment.maturity_date), 'dd.MM.yyyy') : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Investment Type</p>
                          <p className="font-semibold text-gray-900">{investment.investment_type}</p>
                        </div>
                      </div>
                      {investment.terms && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600">Terms</p>
                          <p className="text-gray-900 mt-1">{investment.terms}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal
        isOpen={showInvestmentModal}
        onClose={() => {
          setShowInvestmentModal(false)
          resetInvestmentForm()
        }}
        title="Add New Investment"
        size="large"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Project">
            <Select
              value={newInvestment.project_id}
              onChange={(e) => setNewInvestment({ ...newInvestment, project_id: e.target.value })}
            >
              <option value="">Select Project (Optional)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Investor" required>
            <Select
              value={newInvestment.investor_id}
              onChange={(e) => setNewInvestment({ ...newInvestment, investor_id: e.target.value })}
              required
            >
              <option value="">Select Investor</option>
              {investors.map((investor) => (
                <option key={investor.id} value={investor.id}>
                  {investor.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Investment Type">
            <Select
              value={newInvestment.investment_type}
              onChange={(e) => setNewInvestment({ ...newInvestment, investment_type: e.target.value })}
            >
              <option value="equity">Equity</option>
              <option value="debt">Debt</option>
              <option value="convertible_note">Convertible Note</option>
              <option value="safe">SAFE</option>
            </Select>
          </FormField>

          <FormField label="Amount (€)" required>
            <Input
              type="number"
              value={newInvestment.amount}
              onChange={(e) => setNewInvestment({ ...newInvestment, amount: parseFloat(e.target.value) || 0 })}
              required
            />
          </FormField>

          <FormField label="Percentage Stake (%)">
            <Input
              type="number"
              step="0.01"
              value={newInvestment.percentage_stake}
              onChange={(e) => setNewInvestment({ ...newInvestment, percentage_stake: parseFloat(e.target.value) || 0 })}
            />
          </FormField>

          <FormField label="Expected Return (€)">
            <Input
              type="number"
              value={newInvestment.expected_return}
              onChange={(e) => setNewInvestment({ ...newInvestment, expected_return: parseFloat(e.target.value) || 0 })}
            />
          </FormField>

          <FormField label="Investment Date" required>
            <DateInput
              value={newInvestment.investment_date}
              onChange={(value) => setNewInvestment({ ...newInvestment, investment_date: value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </FormField>

          <FormField label="Maturity Date">
            <DateInput
              value={newInvestment.maturity_date}
              onChange={(value) => setNewInvestment({ ...newInvestment, maturity_date: value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FormField>

          <FormField label="Status">
            <Select
              value={newInvestment.status}
              onChange={(e) => setNewInvestment({ ...newInvestment, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </FormField>

          <FormField label="Terms" className="md:col-span-2">
            <Textarea
              value={newInvestment.terms}
              onChange={(e) => setNewInvestment({ ...newInvestment, terms: e.target.value })}
              rows={3}
              placeholder="Investment terms and conditions"
            />
          </FormField>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="bg-blue-50 p-4 rounded-lg">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newInvestment.disbursed_to_account || false}
                onChange={(e) => {
                  const checked = e.target.checked
                  setNewInvestment({
                    ...newInvestment,
                    disbursed_to_account: checked,
                    disbursed_to_bank_account_id: checked ? newInvestment.disbursed_to_bank_account_id : ''
                  })
                }}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">Isplata na račun</span>
                <p className="text-sm text-gray-600 mt-1">
                  Kada je označeno, ceo iznos investicije će automatski biti isplaćen na odabrani bankovni račun firme.
                </p>
              </div>
            </label>

            {newInvestment.disbursed_to_account && (
              <div className="mt-4">
                {!newInvestment.project_id ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">Molimo prvo odaberite projekat da biste videli dostupne bankovne račune.</p>
                  </div>
                ) : loadingAccounts ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600">Učitavanje računa...</p>
                  </div>
                ) : companyBankAccounts.length === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">Firma za odabrani projekat nema bankovnih računa. Molimo dodajte račun u "Moje firme" prvo.</p>
                  </div>
                ) : (
                  <FormField label="Bankovni račun" required>
                    <Select
                      value={newInvestment.disbursed_to_bank_account_id || ''}
                      onChange={(e) => setNewInvestment({ ...newInvestment, disbursed_to_bank_account_id: e.target.value })}
                      required={newInvestment.disbursed_to_account}
                    >
                      <option value="">Odaberite račun</option>
                      {companyBankAccounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name || 'Nepoznata banka'} {account.account_number ? `- ${account.account_number}` : ''} (Saldo: €{Number(account.current_balance).toLocaleString('hr-HR')})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <Button
            variant="secondary"
            onClick={() => {
              setShowInvestmentModal(false)
              resetInvestmentForm()
            }}
          >
            Cancel
          </Button>
          <Button onClick={addInvestment}>
            Add Investment
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default InvestmentsManagement
