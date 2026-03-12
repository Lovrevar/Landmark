import React from 'react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState } from '../../ui'
import { FileText, Calendar, Download, TrendingUp, AlertCircle, Building2, CheckSquare, Square } from 'lucide-react'
import { format } from 'date-fns'
import { useRetailInvoices } from './hooks/useRetailInvoices'

const INVOICE_TYPE_LABELS: Record<string, string> = {
  INCOMING_SUPPLIER: 'Ulazni - Dobavljač',
  OUTGOING_SALES: 'Izlazni - Prodaja',
  OUTGOING_SUPPLIER: 'Izlazni - Dobavljač',
  INCOMING_INVESTMENT: 'Ulazni - Investicija',
}

const RetailInvoicesManagement: React.FC = () => {
  const {
    loading,
    stats,
    filteredInvoices,
    searchTerm,
    setSearchTerm,
    filterApproved,
    setFilterApproved,
    filterType,
    setFilterType,
    dateRange,
    setDateRange,
    handleApprove,
    handleExportCSV,
  } = useRetailInvoices()

  if (loading) return <LoadingSpinner message="Učitavanje retail računa..." />

  return (
    <div className="p-6">
      <PageHeader
        title="Retail Računi"
        description="Pregled i odobravanje retail računa za slanje u cashflow"
      />

      <StatGrid columns={4} className="mb-8">
        <StatCard label="Ukupno računa" value={stats.totalInvoices} icon={FileText} color="blue" />
        <StatCard label="Ukupan iznos" value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={FileText} color="green" />
        <StatCard label="Ovaj mjesec" value={stats.invoicesThisMonth} subtitle="računa" icon={Calendar} />
        <StatCard label="Iznos ovaj mj." value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="teal" />
      </StatGrid>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              placeholder="Pretraži račune..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
            />
          </div>

          <Select value={filterType} onChange={(e) => setFilterType(e.target.value as 'all' | 'incoming' | 'outgoing')}>
            <option value="all">Svi tipovi</option>
            <option value="incoming">Ulazni</option>
            <option value="outgoing">Izlazni</option>
          </Select>

          <Select value={filterApproved} onChange={(e) => setFilterApproved(e.target.value as 'all' | 'approved' | 'not_approved')}>
            <option value="all">Sve</option>
            <option value="approved">Odobreno</option>
            <option value="not_approved">Nije odobreno</option>
          </Select>

          <Button variant="success" icon={Download} onClick={handleExportCSV} fullWidth>
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label="Datum od">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label="Datum do">
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
          title="Nema računa"
          description="Nema retail računa koji odgovaraju zadanim filterima"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full min-w-[1200px] bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">Odobri</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj računa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dospijeće</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projekt</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dobavljač / Kupac</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Iznos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={`hover:bg-gray-50 transition-colors ${invoice.approved ? 'bg-green-50/30' : ''}`}
                >
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleApprove(invoice.id, invoice.approved)}
                      title={invoice.approved ? 'Odobreno - klikni za poništenje' : 'Klikni za odobravanje'}
                      className={`p-1 rounded transition-colors ${
                        invoice.approved
                          ? 'text-green-600 hover:text-green-800'
                          : 'text-gray-400 hover:text-blue-600'
                      }`}
                    >
                      {invoice.approved ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{invoice.invoice_number}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={invoice.invoice_type.startsWith('INCOMING') ? 'blue' : 'gray'} size="sm">
                      {INVOICE_TYPE_LABELS[invoice.invoice_type] || invoice.invoice_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{format(new Date(invoice.issue_date), 'dd.MM.yyyy')}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{format(new Date(invoice.due_date), 'dd.MM.yyyy')}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{invoice.project_name}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {invoice.supplier_name || invoice.customer_name || '-'}
                  </td>
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

export default RetailInvoicesManagement
