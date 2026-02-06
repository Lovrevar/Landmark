import React, { useState, useEffect } from 'react'
import { supabase, Investor, ProjectInvestment, Project } from '../../../lib/supabase'
import { Plus, Phone, Mail, CreditCard as Edit2, Trash2, Eye, PieChart } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { PageHeader, LoadingSpinner, Modal, FormField, Input, Select, Textarea, Button, Badge, EmptyState } from '../../ui'

interface InvestorWithInvestments extends Investor {
  investments: ProjectInvestment[]
  total_committed: number
  active_investments: number
  portfolio_performance: number
  projects: Project[]
}

const InvestorsManagement: React.FC = () => {
  const [investors, setInvestors] = useState<InvestorWithInvestments[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedInvestor, setSelectedInvestor] = useState<InvestorWithInvestments | null>(null)
  const [showInvestorForm, setShowInvestorForm] = useState(false)
  const [showInvestmentForm, setShowInvestmentForm] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null)
  const [editingInvestment, setEditingInvestment] = useState<ProjectInvestment | null>(null)
  const [newInvestor, setNewInvestor] = useState({
    name: '',
    type: 'individual' as const,
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    total_invested: 0,
    expected_return: 0,
    investment_start: '',
    risk_profile: 'moderate' as const,
    preferred_sectors: '',
    notes: ''
  })
  const [newInvestment, setNewInvestment] = useState({
    investor_id: '',
    project_id: '',
    investment_type: 'equity' as const,
    amount: 0,
    percentage_stake: 0,
    expected_return: 0,
    investment_date: '',
    maturity_date: '',
    payment_schedule: 'yearly' as 'monthly' | 'yearly',
    terms: '',
    mortgages_insurance: 0,
    notes: '',
    usage_expiration_date: '',
    grace_period: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])


  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch investors
      const { data: investorsData, error: investorsError } = await supabase
        .from('investors')
        .select('*')
        .order('name')

      if (investorsError) throw investorsError

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      if (projectsError) throw projectsError

      // Fetch project investments
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('project_investments')
        .select(`
          *,
          projects(*)
        `)
        .order('investment_date', { ascending: false })

      if (investmentsError) throw investmentsError

      // Process investors with investments
      const investorsWithInvestments = (investorsData || []).map(investor => {
        const investorInvestments = (investmentsData || []).filter(inv => inv.investor_id === investor.id)
        const total_committed = investorInvestments.reduce((sum, inv) => sum + inv.amount, 0)
        const active_investments = investorInvestments.filter(inv => inv.status === 'active').length
        const portfolio_performance = investorInvestments.length > 0
          ? investorInvestments.reduce((sum, inv) => sum + inv.expected_return, 0) / investorInvestments.length
          : 0

        const uniqueProjects = investorInvestments
          .filter(inv => inv.projects)
          .map(inv => inv.projects)
          .filter((project, index, self) => 
            index === self.findIndex(p => p.id === project.id)
          )

        return {
          ...investor,
          investments: investorInvestments,
          total_committed,
          active_investments,
          portfolio_performance,
          projects: uniqueProjects
        }
      })

      setInvestors(investorsWithInvestments)
      setProjects(projectsData || [])
    } catch (error) {
      console.error('Error fetching investors data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addInvestor = async () => {
    if (!newInvestor.name.trim()) {
      alert('Please enter investor name')
      return
    }

    try {
      const { error } = await supabase
        .from('investors')
        .insert(newInvestor)

      if (error) throw error

      resetInvestorForm()
      await fetchData()
    } catch (error) {
      console.error('Error adding investor:', error)
      alert('Error adding investor. Please try again.')
    }
  }

  const updateInvestor = async () => {
    if (!editingInvestor || !newInvestor.name.trim()) return

    try {
      const { error } = await supabase
        .from('investors')
        .update(newInvestor)
        .eq('id', editingInvestor.id)

      if (error) throw error

      resetInvestorForm()
      await fetchData()
    } catch (error) {
      console.error('Error updating investor:', error)
      alert('Error updating investor.')
    }
  }

  const deleteInvestor = async (investorId: string) => {
    if (!confirm('Are you sure you want to delete this investor? This will also delete all associated investments.')) return

    try {
      const { error } = await supabase
        .from('investors')
        .delete()
        .eq('id', investorId)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting investor:', error)
      alert('Error deleting investor.')
    }
  }

  const addInvestment = async () => {
    if (editingInvestment) {
      await handleUpdateInvestment()
      return
    }

    if (!newInvestment.investor_id || !newInvestment.amount) {
      alert('Please fill in required fields (Investor and Amount)')
      return
    }

    try {
      const { error } = await supabase
        .from('project_investments')
        .insert({
          ...newInvestment,
          project_id: newInvestment.project_id || null
        })

      if (error) throw error

      resetInvestmentForm()
      await fetchData()
    } catch (error) {
      console.error('Error adding investment:', error)
      alert('Error adding investment.')
    }
  }

  const resetInvestorForm = () => {
    setNewInvestor({
      name: '',
      type: 'individual',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      total_invested: 0,
      expected_return: 0,
      investment_start: '',
      risk_profile: 'moderate',
      preferred_sectors: '',
      notes: ''
    })
    setEditingInvestor(null)
    setShowInvestorForm(false)
  }

  const resetInvestmentForm = () => {
    setNewInvestment({
      investor_id: '',
      project_id: '',
      investment_type: 'equity',
      amount: 0,
      percentage_stake: 0,
      expected_return: 0,
      investment_date: '',
      maturity_date: '',
      payment_schedule: 'yearly',
      terms: '',
      mortgages_insurance: 0,
      notes: '',
      usage_expiration_date: '',
      grace_period: 0
    })
    setEditingInvestment(null)
    setShowInvestmentForm(false)
  }

  const handleEditInvestment = (investment: ProjectInvestment) => {
    setEditingInvestment(investment)
    setNewInvestment({
      investor_id: investment.investor_id,
      project_id: investment.project_id,
      investment_type: `${investment.investment_type}`,
      amount: investment.amount,
      percentage_stake: investment.percentage_stake || 0,
      expected_return: investment.expected_return,
      investment_date: investment.investment_date,
      maturity_date: investment.maturity_date || '',
      payment_schedule: investment.payment_schedule || 'yearly',
      terms: investment.terms || '',
      mortgages_insurance: investment.mortgages_insurance || 0,
      notes: investment.notes || '',
      usage_expiration_date: investment.usage_expiration_date || '',
      grace_period: investment.grace_period || 0
    })
    setSelectedInvestor(null)
    setShowInvestmentForm(true)
  }

  const handleDeleteInvestment = async (investmentId: string) => {
    if (!confirm('Are you sure you want to delete this investment?')) return

    try {
      const { error } = await supabase
        .from('project_investments')
        .delete()
        .eq('id', investmentId)

      if (error) throw error

      await fetchData()
    } catch (error) {
      console.error('Error deleting investment:', error)
      alert('Error deleting investment.')
    }
  }

  const handleUpdateInvestment = async () => {
    if (!editingInvestment) return

    if (!newInvestment.investor_id || !newInvestment.amount) {
      alert('Please fill in all required fields (Investor and Amount)')
      return
    }

    try {
      const { error } = await supabase
        .from('project_investments')
        .update({
          investor_id: newInvestment.investor_id,
          project_id: newInvestment.project_id || null,
          investment_type: newInvestment.investment_type,
          amount: newInvestment.amount,
          percentage_stake: newInvestment.percentage_stake,
          expected_return: newInvestment.expected_return,
          investment_date: newInvestment.investment_date,
          maturity_date: newInvestment.maturity_date || null,
          payment_schedule: newInvestment.payment_schedule,
          terms: newInvestment.terms,
          mortgages_insurance: newInvestment.mortgages_insurance,
          notes: newInvestment.notes,
          usage_expiration_date: newInvestment.usage_expiration_date || null,
          grace_period: newInvestment.grace_period
        })
        .eq('id', editingInvestment.id)

      if (error) throw error

      resetInvestmentForm()
      await fetchData()
    } catch (error) {
      console.error('Error updating investment:', error)
      alert('Error updating investment.')
    }
  }


  const handleEditInvestor = (investor: Investor) => {
    setEditingInvestor(investor)
    setNewInvestor({
      name: investor.name,
      type: investor.type,
      contact_person: investor.contact_person || '',
      contact_email: investor.contact_email || '',
      contact_phone: investor.contact_phone || '',
      total_invested: investor.total_invested,
      expected_return: investor.expected_return,
      investment_start: investor.investment_start || '',
      risk_profile: investor.risk_profile,
      preferred_sectors: investor.preferred_sectors || '',
      notes: investor.notes || ''
    })
    setShowInvestorForm(true)
  }


  if (loading) {
    return <LoadingSpinner message="Loading investors..." />
  }

  return (
    <div>
      <PageHeader
        title="Investment Partners"
        description="Manage investor relationships and investment portfolios"
        actions={
          <div className="flex space-x-3">
            <Button icon={Plus} onClick={() => setShowInvestorForm(true)}>Add Investor</Button>
            <Button icon={Plus} variant="success" onClick={() => setShowInvestmentForm(true)}>Add Investment</Button>
          </div>
        }
      />

      {/* Investors Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {investors.map((investor) => (
          <div
            key={investor.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => setSelectedInvestor(investor)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{investor.name}</h3>
                  <Badge variant={
                    investor.type === 'individual' ? 'blue' :
                    investor.type === 'fund' ? 'green' :
                    investor.type === 'government' ? 'orange' : 'gray'
                  } size="sm">
                    {investor.type.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{investor.contact_person}</p>
                <p className="text-xs text-gray-500">{investor.contact_email}</p>
              </div>
              <div className="flex space-x-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  icon={Eye}
                  onClick={(e) => { e.stopPropagation(); setSelectedInvestor(investor) }}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  icon={Edit2}
                  onClick={(e) => { e.stopPropagation(); handleEditInvestor(investor) }}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  icon={Trash2}
                  onClick={(e) => { e.stopPropagation(); deleteInvestor(investor.id) }}
                />
              </div>
            </div>

            {/* Investment Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">€{(investor.total_committed / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-gray-600">Committed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{investor.expected_return.toFixed(1)}%</p>
                <p className="text-xs text-gray-600">Expected ROI</p>
              </div>
            </div>

            {/* Risk Profile */}
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Risk Profile</span>
                <Badge variant={
                  investor.risk_profile === 'conservative' ? 'green' :
                  investor.risk_profile === 'moderate' ? 'yellow' : 'red'
                } size="sm">
                  {investor.risk_profile.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Additional Info */}
            <div className="border-t pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Active Investments</span>
                <span className="text-sm font-medium text-gray-900">{investor.active_investments}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Portfolio Projects</span>
                <span className="text-sm font-medium text-gray-900">{investor.projects.length}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal show={showInvestorForm} onClose={resetInvestorForm} size="lg">
        <Modal.Header title={editingInvestor ? 'Edit Investor' : 'Add New Investor'} onClose={resetInvestorForm} />
        <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormField label="Investor Name" required>
                <Input
                  type="text"
                  value={newInvestor.name}
                  onChange={(e) => setNewInvestor({ ...newInvestor, name: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label="Investor Type">
              <Select
                value={newInvestor.type}
                onChange={(e) => setNewInvestor({ ...newInvestor, type: e.target.value as any })}
              >
                <option value="individual">Individual</option>
                <option value="institutional">Institutional</option>
                <option value="fund">Investment Fund</option>
                <option value="government">Government</option>
              </Select>
            </FormField>
            <FormField label="Risk Profile">
              <Select
                value={newInvestor.risk_profile}
                onChange={(e) => setNewInvestor({ ...newInvestor, risk_profile: e.target.value as any })}
              >
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </Select>
            </FormField>
            <FormField label="Contact Person">
              <Input
                type="text"
                value={newInvestor.contact_person}
                onChange={(e) => setNewInvestor({ ...newInvestor, contact_person: e.target.value })}
              />
            </FormField>
            <FormField label="Contact Email">
              <Input
                type="email"
                value={newInvestor.contact_email}
                onChange={(e) => setNewInvestor({ ...newInvestor, contact_email: e.target.value })}
              />
            </FormField>
            <FormField label="Contact Phone">
              <Input
                type="tel"
                value={newInvestor.contact_phone}
                onChange={(e) => setNewInvestor({ ...newInvestor, contact_phone: e.target.value })}
              />
            </FormField>
            <FormField label="Investment Start Date">
              <Input
                type="date"
                value={newInvestor.investment_start}
                onChange={(e) => setNewInvestor({ ...newInvestor, investment_start: e.target.value })}
              />
            </FormField>
            <FormField label="Total Invested">
              <Input
                type="number"
                value={newInvestor.total_invested}
                onChange={(e) => setNewInvestor({ ...newInvestor, total_invested: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="IRR">
              <Input
                type="number"
                step="0.1"
                value={newInvestor.expected_return}
                onChange={(e) => setNewInvestor({ ...newInvestor, expected_return: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Preferred Sectors">
                <Input
                  type="text"
                  value={newInvestor.preferred_sectors}
                  onChange={(e) => setNewInvestor({ ...newInvestor, preferred_sectors: e.target.value })}
                  placeholder="e.g., Residential, Commercial, Mixed-use"
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Notes">
                <Textarea
                  value={newInvestor.notes}
                  onChange={(e) => setNewInvestor({ ...newInvestor, notes: e.target.value })}
                  rows={3}
                />
              </FormField>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={resetInvestorForm}>Cancel</Button>
          <Button onClick={editingInvestor ? updateInvestor : addInvestor}>
            {editingInvestor ? 'Update' : 'Add'} Investor
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showInvestmentForm} onClose={resetInvestmentForm} size="lg">
        <Modal.Header title={editingInvestment ? 'Edit Investment' : 'Add New Investment'} onClose={resetInvestmentForm} />
        <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Investor" required>
              <Select
                value={newInvestment.investor_id}
                onChange={(e) => setNewInvestment({ ...newInvestment, investor_id: e.target.value })}
              >
                <option value="">Select investor</option>
                {investors.map(investor => (
                  <option key={investor.id} value={investor.id}>{investor.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Project (optional)">
              <Select
                value={newInvestment.project_id}
                onChange={(e) => setNewInvestment({ ...newInvestment, project_id: e.target.value })}
              >
                <option value="">No project (refinancing, operation costs, etc.)</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Investment Type">
              <Select
                value={newInvestment.investment_type}
                onChange={(e) => setNewInvestment({ ...newInvestment, investment_type: e.target.value as any })}
              >
                <option value="equity">Equity</option>
                <option value="loan">Loan</option>
                <option value="grant">Grant</option>
                <option value="bond">Bond</option>
                <option value="Operation Cost Loan">Operation Cost Loan</option>
                <option value="Refinancing Loan">Refinancing Loan</option>
              </Select>
            </FormField>
            <FormField label="Amount" required>
              <Input
                type="number"
                value={newInvestment.amount}
                onChange={(e) => setNewInvestment({ ...newInvestment, amount: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Percentage Stake (%)">
              <Input
                type="number"
                step="0.1"
                value={newInvestment.percentage_stake}
                onChange={(e) => setNewInvestment({ ...newInvestment, percentage_stake: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="IRR (%)">
              <Input
                type="number"
                step="0.1"
                value={newInvestment.expected_return}
                onChange={(e) => setNewInvestment({ ...newInvestment, expected_return: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Payment Schedule">
              <Select
                value={newInvestment.payment_schedule}
                onChange={(e) => setNewInvestment({ ...newInvestment, payment_schedule: e.target.value as 'monthly' | 'yearly' })}
              >
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </FormField>
            <FormField
              label={`${newInvestment.payment_schedule === 'yearly' ? 'Yearly' : 'Monthly'} Cashflow`}
              helperText={`${newInvestment.payment_schedule === 'yearly' ? 'Annual' : 'Monthly'} payment amount based on IRR and investment period minus grace period`}
            >
              <Input
                type="text"
                value={(() => {
                  if (!newInvestment.amount || !newInvestment.investment_date || !newInvestment.maturity_date || !newInvestment.expected_return) {
                    return 'Enter amount, dates, and IRR to calculate'
                  }
                  const principal = newInvestment.amount
                  const annualRate = newInvestment.expected_return / 100
                  const gracePeriodYears = newInvestment.grace_period / 365
                  const startDate = new Date(newInvestment.investment_date)
                  const maturityDate = new Date(newInvestment.maturity_date)
                  const totalYears = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                  if (totalYears <= 0) return 'Invalid date range'
                  const repaymentYears = Math.max(0.1, totalYears - gracePeriodYears)
                  if (annualRate === 0) {
                    const payment = newInvestment.payment_schedule === 'yearly'
                      ? principal / repaymentYears
                      : principal / (repaymentYears * 12)
                    return `${payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  }
                  let payment
                  if (newInvestment.payment_schedule === 'yearly') {
                    payment = (principal * annualRate * Math.pow(1 + annualRate, repaymentYears)) /
                             (Math.pow(1 + annualRate, repaymentYears) - 1)
                  } else {
                    const monthlyRate = annualRate / 12
                    const totalMonths = repaymentYears * 12
                    payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
                             (Math.pow(1 + monthlyRate, totalMonths) - 1)
                  }
                  return `${payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                })()}
                readOnly
                className="bg-gray-50"
              />
            </FormField>
            <FormField label="Money Multiple" helperText="Total return multiple">
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                {(() => {
                  if (!newInvestment.amount || !newInvestment.investment_date || !newInvestment.maturity_date || !newInvestment.expected_return) {
                    return 'Enter amount, dates, and IRR to calculate'
                  }
                  const principal = newInvestment.amount
                  const annualRate = newInvestment.expected_return / 100
                  const startDate = new Date(newInvestment.investment_date)
                  const maturityDate = new Date(newInvestment.maturity_date)
                  const years = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                  if (years <= 0) return 'Invalid date range'
                  const totalReturn = principal * Math.pow(1 + annualRate, years)
                  const moneyMultiple = totalReturn / principal
                  return `${moneyMultiple.toFixed(2)}x (${(moneyMultiple * 100).toFixed(0)}%)`
                })()}
              </div>
            </FormField>
            <FormField label="Investment Date" required>
              <Input
                type="date"
                value={newInvestment.investment_date}
                onChange={(e) => setNewInvestment({ ...newInvestment, investment_date: e.target.value })}
              />
            </FormField>
            <FormField label="Maturity Date">
              <Input
                type="date"
                value={newInvestment.maturity_date}
                onChange={(e) => setNewInvestment({ ...newInvestment, maturity_date: e.target.value })}
              />
            </FormField>
            <FormField label="Usage Expiration Date">
              <Input
                type="date"
                value={newInvestment.usage_expiration_date}
                onChange={(e) => setNewInvestment({ ...newInvestment, usage_expiration_date: e.target.value })}
              />
            </FormField>
            <FormField label="Grace Period (months)">
              <Input
                type="number"
                value={newInvestment.grace_period}
                onChange={(e) => setNewInvestment({ ...newInvestment, grace_period: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </FormField>
            <FormField label="Mortgages">
              <Input
                type="number"
                step="0.01"
                value={newInvestment.mortgages_insurance}
                onChange={(e) => setNewInvestment({ ...newInvestment, mortgages_insurance: parseFloat(e.target.value) || 0 })}
                placeholder="Amount of mortgages/insurance"
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Mortages">
                <Textarea
                  value={newInvestment.terms}
                  onChange={(e) => setNewInvestment({ ...newInvestment, terms: e.target.value })}
                  rows={3}
                  placeholder="Terms and conditions of the investment..."
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Notes">
                <Textarea
                  value={newInvestment.notes}
                  onChange={(e) => setNewInvestment({ ...newInvestment, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes about this investment..."
                />
              </FormField>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={resetInvestmentForm}>Cancel</Button>
          <Button variant="success" onClick={addInvestment}>
            {editingInvestment ? 'Update' : 'Add'} Investment
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!selectedInvestor} onClose={() => setSelectedInvestor(null)} size="xl">
        {selectedInvestor && (
          <>
            <Modal.Header
              title={selectedInvestor.name}
              subtitle={selectedInvestor.contact_person}
              onClose={() => setSelectedInvestor(null)}
            />
            <Modal.Body>
              <div className="flex items-center space-x-4 mb-4 flex-wrap gap-y-2">
                <Badge variant={
                  selectedInvestor.type === 'individual' ? 'blue' :
                  selectedInvestor.type === 'fund' ? 'green' :
                  selectedInvestor.type === 'government' ? 'orange' : 'gray'
                } size="sm">
                  {selectedInvestor.type.toUpperCase()}
                </Badge>
                <Badge variant={
                  selectedInvestor.risk_profile === 'conservative' ? 'green' :
                  selectedInvestor.risk_profile === 'moderate' ? 'yellow' : 'red'
                } size="sm">
                  {selectedInvestor.risk_profile.toUpperCase()}
                </Badge>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 text-gray-400 mr-1" />
                  <span className="text-sm text-gray-600">{selectedInvestor.contact_email}</span>
                </div>
                <div className="flex items-center">
                  <Phone className="w-4 h-4 text-gray-400 mr-1" />
                  <span className="text-sm text-gray-600">{selectedInvestor.contact_phone}</span>
                </div>
              </div>
              {/* Investment Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3">Investment Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-green-700">Total Committed:</span>
                      <span className="font-medium text-green-900">€{selectedInvestor.total_committed.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Active Investments:</span>
                      <span className="font-medium text-green-900">{selectedInvestor.active_investments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Portfolio Projects:</span>
                      <span className="font-medium text-green-900">{selectedInvestor.projects.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Expected ROI:</span>
                      <span className="font-medium text-green-900">{selectedInvestor.expected_return}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Relationship Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Since:</span>
                      <span className="font-medium text-blue-900">
                        {selectedInvestor.investment_start 
                          ? format(new Date(selectedInvestor.investment_start), 'MMM yyyy')
                          : 'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Risk Profile:</span>
                      <span className="font-medium text-blue-900">{selectedInvestor.risk_profile}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Sectors:</span>
                      <span className="font-medium text-blue-900 text-right text-xs">
                        {selectedInvestor.preferred_sectors || 'Any'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Relationship:</span>
                      <span className="font-medium text-blue-900">
                        {selectedInvestor.investment_start 
                          ? `${Math.floor(differenceInDays(new Date(), new Date(selectedInvestor.investment_start)) / 365)}y`
                          : 'New'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-3">Performance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-purple-700">Portfolio ROI:</span>
                      <span className="font-medium text-purple-900">{selectedInvestor.portfolio_performance.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Avg. Investment:</span>
                      <span className="font-medium text-purple-900">
                        €{selectedInvestor.investments.length > 0 
                          ? (selectedInvestor.total_committed / selectedInvestor.investments.length).toLocaleString('hr-HR')
                          : '0'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Diversification:</span>
                      <span className="font-medium text-purple-900">
                        {selectedInvestor.projects.length} project{selectedInvestor.projects.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Investment Portfolio */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Investment Portfolio</h4>
                {selectedInvestor.investments.length === 0 ? (
                  <EmptyState
                    icon={PieChart}
                    title="No investments"
                    description="No investments with this investor yet"
                  />
                ) : (
                  <div className="space-y-3">
                    {selectedInvestor.investments.map((investment) => {
                      const isMaturing = investment.maturity_date && differenceInDays(new Date(investment.maturity_date), new Date()) <= 90
                      
                      return (
                        <div key={investment.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <p className="font-medium text-gray-900">
                                  {investment.projects?.name || 'Unknown Project'}
                                </p>
                                <Badge variant={
                                  investment.investment_type === 'equity' ? 'green' :
                                  investment.investment_type === 'loan' ? 'blue' : 'gray'
                                } size="sm">
                                  {investment.investment_type.toUpperCase()}
                                </Badge>
                                <Badge variant={investment.credit_seniority === 'senior' ? 'blue' : 'orange'} size="sm">
                                  {investment.credit_seniority?.toUpperCase() || 'SENIOR'}
                                </Badge>
                                <Badge variant={
                                  investment.status === 'active' ? 'green' :
                                  investment.status === 'completed' ? 'gray' : 'red'
                                } size="sm">
                                  {investment.status.toUpperCase()}
                                </Badge>
                                {isMaturing && (
                                  <Badge variant="orange" size="sm">MATURING SOON</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{investment.terms}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">€{investment.amount.toLocaleString('hr-HR')}</p>
                              <p className="text-sm text-gray-600">{investment.expected_return}% IRR</p>
                              {investment.mortgages_insurance > 0 && (
                                <p className="text-xs text-orange-600">+€{investment.mortgages_insurance.toLocaleString('hr-HR')} mortgages</p>
                              )}
                              <p className="text-xs text-blue-600">
                                {((1 + investment.expected_return / 100) * 100).toFixed(0)}% money multiple
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Investment Date</p>
                              <p className="text-sm font-medium text-gray-900">
                                {format(new Date(investment.investment_date), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Ownership Stake</p>
                              <p className="text-sm font-medium text-gray-900">{investment.percentage_stake}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Credit Seniority</p>
                              <p className={`text-sm font-medium ${
                                investment.credit_seniority === 'senior' ? 'text-blue-600' : 'text-orange-600'
                              }`}>
                                {investment.credit_seniority?.charAt(0).toUpperCase() + investment.credit_seniority?.slice(1) || 'Senior'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Additional Investment Details */}
                          {(investment.mortgages_insurance > 0 || investment.notes) && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              {investment.mortgages_insurance > 0 && (
                                <div className="mb-2">
                                  <p className="text-xs text-gray-500">Mortgages (Insurance)</p>
                                  <p className="text-sm font-medium text-orange-600">€{investment.mortgages_insurance.toLocaleString('hr-HR')}</p>
                                </div>
                              )}
                              {investment.notes && (
                                <div>
                                  <p className="text-xs text-gray-500">Notes</p>
                                  <p className="text-sm text-gray-700">{investment.notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                            <div>
                              <p className="text-xs text-gray-500">Maturity Date</p>
                              <p className={`text-sm font-medium ${isMaturing ? 'text-orange-600' : 'text-gray-900'}`}>
                                {investment.maturity_date ? format(new Date(investment.maturity_date), 'MMM dd, yyyy') : 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="pt-3 mt-3 border-t border-gray-200 flex gap-2">
                            <Button icon={Edit2} onClick={() => handleEditInvestment(investment)} size="sm">Edit</Button>
                            <Button icon={Trash2} variant="danger" onClick={() => handleDeleteInvestment(investment.id)} size="sm" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedInvestor.notes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                  <p className="text-gray-700">{selectedInvestor.notes}</p>
                </div>
              )}
            </Modal.Body>
          </>
        )}
      </Modal>

    </div>
  )
}

export default InvestorsManagement