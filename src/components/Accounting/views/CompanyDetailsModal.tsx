import React from 'react'
import { X, DollarSign, TrendingUp, FileText, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { CompanyStats, Invoice } from '../types/companyTypes'

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
  if (!show || !company) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{company.name}</h2>
            <p className="text-sm text-gray-600">OIB: {company.oib}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700">Početno stanje</p>
              <p className="text-2xl font-bold text-blue-900">€{company.initial_balance.toLocaleString('hr-HR')}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-700">Izdano računa</p>
              <p className="text-2xl font-bold text-green-900">€{company.total_income_paid.toLocaleString('hr-HR')}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-red-700">Plaćeno računa</p>
              <p className="text-2xl font-bold text-red-900">€{company.total_expense_paid.toLocaleString('hr-HR')}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700">Trenutno stanje</p>
              <p className={`text-2xl font-bold ${company.current_balance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                €{company.current_balance.toLocaleString('hr-HR')}
              </p>
            </div>
            <div className={`${company.profit >= 0 ? 'bg-green-50' : 'bg-red-50'} p-4 rounded-lg`}>
              <p className={`text-sm ${company.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {company.profit >= 0 ? 'Dobit' : 'Gubitak'}
              </p>
              <p className={`text-2xl font-bold ${company.profit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                €{Math.abs(company.profit).toLocaleString('hr-HR')}
              </p>
            </div>
          </div>

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
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                            ISTEKAO
                          </span>
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
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isIncomeInvoice(invoice.invoice_type) ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                          }`}>
                            {isIncomeInvoice(invoice.invoice_type) ? 'PRIHOD' : 'RASHOD'}
                          </span>
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
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {invoice.status === 'PAID' ? 'Plaćeno' :
                         invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                      </span>
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
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  )
}

export default CompanyDetailsModal
