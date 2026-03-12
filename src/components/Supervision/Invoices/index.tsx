import React from 'react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState } from '../../ui'
import { FileText, Calendar, Download, TrendingUp, AlertCircle, Building2, CheckSquare, Square } from 'lucide-react'
import { format } from 'date-fns'
import { useSupervisionInvoices } from './hooks/useSupervisionInvoices'

const InvoicesManagement: React.FC = () => {
  const {
    loading,
    stats,
    filteredInvoices,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filterApproved,
    setFilterApproved,
    dateRange,
    setDateRange,
    handleApprove,
    handleExportCSV,
  } = useSupervisionInvoices()

  if (loading) {
    return <LoadingSpinner message="Loading invoices..." />
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Project Invoices"
        description="Track and manage supplier and supervision invoices for all projects"
      />

      <StatGrid columns={4} className="mb-8">
        <StatCard label="Total Invoices" value={stats.totalInvoices} icon={FileText} color="blue" />
        <StatCard label="Total Amount" value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={FileText} color="green" />
        <StatCard label="This Month" value={stats.invoicesThisMonth} subtitle="invoices" icon={Calendar} />
        <StatCard label="Month Amount" value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="teal" />
      </StatGrid>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
            />
          </div>

          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'recent' | 'large')}>
            <option value="all">All Invoices</option>
            <option value="recent">Recent (7 days)</option>
            <option value="large">Large (&gt; €10k)</option>
          </Select>

          <Select value={filterApproved} onChange={(e) => setFilterApproved(e.target.value as 'all' | 'approved' | 'not_approved')}>
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="not_approved">Not Approved</option>
          </Select>

          <Button variant="success" icon={Download} onClick={handleExportCSV} fullWidth>
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label="Start Date">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label="End Date">
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No invoices found"
          description="Try adjusting your search or filters"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full min-w-[1400px] bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">Appr.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={invoice.approved ? CheckSquare : Square}
                      onClick={() => handleApprove(invoice.id, invoice.approved)}
                      title={invoice.approved ? "Approved" : "Click to approve"}
                      className={invoice.approved ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-blue-600'}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{invoice.invoice_number}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={invoice.invoice_category === 'SUPERVISION' ? 'blue' : 'gray'} size="sm">
                      {invoice.invoice_category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{format(new Date(invoice.issue_date), 'dd.MM.yyyy')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{invoice.supplier_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{invoice.project_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{invoice.phase_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-800">{invoice.company_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                    €{invoice.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={
                      invoice.status === 'PAID' ? 'green'
                        : invoice.status === 'PARTIALLY_PAID' ? 'yellow'
                        : 'red'
                    }>
                      {invoice.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default InvoicesManagement
