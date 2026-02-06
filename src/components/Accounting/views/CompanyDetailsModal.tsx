import React from 'react'
import { DollarSign, TrendingUp, FileText, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { CompanyStats, Invoice } from '../types/companyTypes'
import { Modal, Button, Badge, StatCard, StatGrid } from '../../ui'

interface CompanyDetailsModalProps {
  show: boolean
  company: CompanyStats | null
  onClose: () => void
}

const isIncomeInvoice = (invoiceType: string) => {
  return invoiceType === 'INCOMING_INVESTMENT' || invoiceType === 'OUTGOING_SALES' || invoiceType === 'OUTGOING_OFFICE' || invoiceType === 'INCOMING_RETAIL_SALES'
}

const getInvoiceEntityName = (invoice: Invoice) => {
  if (invoice.invoice_type === 'INCOMING_BANK' || invoice.invoice_type === 'OUTGOING_BANK') {
    return invoice.bank?.name || 'N/A'
  }

  if (invoice.invoice_category === 'RETAIL') {
    if (invoice.invoice_type === 'INCOMING_SUPPLIER') {
      return invoice.retail_supplier?.name || 'N/A'
    } else if (invoice.invoice_type === 'OUTGOING_SALES') {
      return invoice.retail_customer?.name || 'N/A'
    }
  }

  if (invoice.invoice_type === 'INCOMING_INVESTMENT' || invoice.invoice_type === 'OUTGOING_SALES') {
    if (invoice.customer) {
      return `${invoice.customer.name} ${invoice.customer.surname}`.trim()
    }
    return 'N/A'
  } else if (invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_OFFICE') {
    return invoice.office_supplier?.name || 'N/A'
  } else if (invoice.invoice_type === 'OUTGOING_RETAIL_DEVELOPMENT' || invoice.invoice_type === 'OUTGOING_RETAIL_CONSTRUCTION') {
    return invoice.retail_supplier?.name || 'N/A'
  } else if (invoice.invoice_type === 'INCOMING_RETAIL_SALES') {
    return invoice.retail_customer?.name || 'N/A'
  } else {
    return invoice.supplier?.name || 'N/A'
  }
}

const CompanyDetailsModal: React.FC<CompanyDetailsModalProps> = ({ show, company, onClose }) => {
  if (!company) return null

  return (
    <Modal show={show} onClose={onClose} size="full">
      <Modal.Header
        title={company.name}
        subtitle={`OIB: ${company.oib}`}
        onClose={onClose}
      />

      <Modal.Body>
        <StatGrid columns={5}>
          <StatCard
            label="Početno stanje"
            value={`€${company.initial_balance.toLocaleString('hr-HR')}`}
            color="blue"
          />
          <StatCard
            label="Izdano računa"
            value={`€${company.total_income_paid.toLocaleString('hr-HR')}`}
            color="green"
          />
          <StatCard
            label="Plaćeno računa"
            value={`€${company.total_expense_paid.toLocaleString('hr-HR')}`}
            color="red"
          />
          <StatCard
            label="Trenutno stanje"
            value={`€${company.current_balance.toLocaleString('hr-HR')}`}
            color="gray"
          />
          <StatCard
            label={company.profit >= 0 ? 'Dobit' : 'Gubitak'}
            value={`€${Math.abs(company.profit).toLocaleString('hr-HR')}`}
            color={company.profit >= 0 ? 'green' : 'red'}
          />
        </StatGrid>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Bankovni računi ({company.bank_accounts.length})
          </h3>
          {company.bank_accounts.length === 0 ? (
            <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">Nema dodanih bankovnih računa</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {company.bank_accounts.map((account) => (
                <div key={account.id} className="bg-white border-2 border-blue-200 rounded-lg p-4">
                  <p className="font-semibold text-gray-900 mb-2">{account.bank_name}</p>
                  {account.account_number && (
                    <p className="text-xs text-gray-500 mb-2">{account.account_number}</p>
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Početno:</span>
                      <span className="font-medium text-gray-900">€{account.initial_balance.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Trenutno:</span>
                      <span className={`font-bold ${account.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        €{account.current_balance.toLocaleString('hr-HR')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Krediti ({company.credits.length})
          </h3>
          {company.credits.length === 0 ? (
            <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">Nema dodanih kredita</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {company.credits.map((credit) => {
                const usedAmount = credit.used_amount || 0
                const available = credit.amount - usedAmount
                const utilizationPercent = credit.amount > 0 ? (usedAmount / credit.amount) * 100 : 0
                const isExpired = new Date(credit.maturity_date) < new Date()

                return (
                  <div key={credit.id} className="bg-white border-2 border-orange-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-gray-900">{credit.credit_name}</p>
                      {isExpired && (
                        <Badge variant="red" size="sm">ISTEKAO</Badge>
                      )}
                    </div>
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Limit:</span>
                        <span className="font-medium text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Iskorišteno:</span>
                        <span className="font-medium text-orange-600">€{usedAmount.toLocaleString('hr-HR')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Dostupno:</span>
                        <span className="font-bold text-green-600">€{available.toLocaleString('hr-HR')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Kamata:</span>
                        <span className="font-medium text-gray-900">{credit.interest_rate}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          utilizationPercent >= 90 ? 'bg-red-500' :
                          utilizationPercent >= 70 ? 'bg-orange-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-right">{utilizationPercent.toFixed(1)}% iskorišteno</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Svi računi ({company.invoices.length})
          </h3>
          {company.invoices.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nema računa</p>
          ) : (
            <div className="space-y-3">
              {company.invoices.map((invoice) => (
                <div key={invoice.id} className={`border-2 rounded-lg p-4 ${
                  invoice.is_cesija_payment
                    ? 'border-purple-200 bg-purple-50'
                    : isIncomeInvoice(invoice.invoice_type) ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {isIncomeInvoice(invoice.invoice_type) ? (
                          <ArrowUpCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <ArrowDownCircle className="w-5 h-5 text-red-600" />
                        )}
                        <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                        <Badge variant={isIncomeInvoice(invoice.invoice_type) ? 'green' : 'red'} size="sm">
                          {isIncomeInvoice(invoice.invoice_type) ? 'PRIHOD' : 'RASHOD'}
                        </Badge>
                        {invoice.is_cesija_payment && (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-purple-200 text-purple-900 border border-purple-400">
                            CESIJA - {invoice.cesija_company_name || 'Nepoznata firma'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {invoice.invoice_type === 'INCOMING_BANK' || invoice.invoice_type === 'OUTGOING_BANK'
                          ? `Banka: ${getInvoiceEntityName(invoice)}`
                          : invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_OFFICE'
                          ? `Office dobavljač: ${getInvoiceEntityName(invoice)}`
                          : isIncomeInvoice(invoice.invoice_type)
                          ? `Kupac: ${getInvoiceEntityName(invoice)}`
                          : `Dobavljač: ${getInvoiceEntityName(invoice)}`}
                      </p>
                      <p className="text-xs text-gray-500">{new Date(invoice.issue_date).toLocaleDateString('hr-HR')}</p>
                    </div>
                    <Badge
                      variant={
                        invoice.status === 'PAID' ? 'green' :
                        invoice.status === 'PARTIALLY_PAID' ? 'yellow' :
                        'gray'
                      }
                      size="sm"
                    >
                      {invoice.status === 'PAID' ? 'Plaćeno' :
                       invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-300">
                    <div>
                      <p className="text-xs text-gray-600">Ukupno</p>
                      <p className="text-sm font-medium">€{invoice.total_amount.toLocaleString('hr-HR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Plaćeno</p>
                      <p className="text-sm font-medium text-green-700">€{invoice.paid_amount.toLocaleString('hr-HR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Preostalo</p>
                      <p className="text-sm font-medium text-orange-700">€{invoice.remaining_amount.toLocaleString('hr-HR')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer sticky>
        <Button variant="secondary" onClick={onClose}>
          Zatvori
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default CompanyDetailsModal
