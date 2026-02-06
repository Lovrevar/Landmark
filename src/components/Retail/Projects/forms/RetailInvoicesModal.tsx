import React, { useState, useEffect } from 'react'
import { FileText, Calendar, DollarSign, Building2, AlertCircle, User } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { format } from 'date-fns'
import type { RetailContract } from '../../../../types/retail'
import { Button, Modal, Badge, EmptyState, LoadingSpinner } from '../../../../components/ui'

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: string
  status: string
  base_amount: number
  vat_amount: number
  total_amount: number
  paid_amount: number
  remaining_amount: number
  issue_date: string
  due_date: string
  description: string
  company_name: string
  supplier_name: string | null
  customer_name: string | null
}

interface RetailInvoicesModalProps {
  isOpen: boolean
  onClose: () => void
  contract: RetailContract | null
}

export const RetailInvoicesModal: React.FC<RetailInvoicesModalProps> = ({
  isOpen,
  onClose,
  contract
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && contract) {
      fetchInvoices()
    }
  }, [isOpen, contract?.id])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const fetchInvoices = async () => {
    if (!contract) return

    console.log('🔍 RetailInvoicesModal - Fetching invoices for CONTRACT:', {
      retail_contract_id: contract.id,
      contract_number: contract.contract_number
    })

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('accounting_invoices')
        .select(`
          id,
          invoice_number,
          invoice_type,
          status,
          base_amount,
          vat_amount,
          total_amount,
          paid_amount,
          remaining_amount,
          issue_date,
          due_date,
          description,
          accounting_companies!accounting_invoices_company_id_fkey(name),
          retail_suppliers(name),
          retail_customers(name)
        `)
        .eq('retail_contract_id', contract.id)
        .order('issue_date', { ascending: false })

      console.log('📦 RetailInvoicesModal - Supabase response:', { data, error, count: data?.length })

      if (error) throw error

      const formattedInvoices = (data || []).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_type: inv.invoice_type,
        status: inv.status,
        base_amount: parseFloat(inv.base_amount),
        vat_amount: parseFloat(inv.vat_amount),
        total_amount: parseFloat(inv.total_amount),
        paid_amount: parseFloat(inv.paid_amount),
        remaining_amount: parseFloat(inv.remaining_amount),
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        description: inv.description || '',
        company_name: inv.accounting_companies?.name || 'N/A',
        supplier_name: inv.retail_suppliers?.name || null,
        customer_name: inv.retail_customers?.name || null
      }))

      console.log('✅ RetailInvoicesModal - Formatted invoices:', formattedInvoices)

      setInvoices(formattedInvoices)
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeVariant = (status: string): 'green' | 'yellow' | 'red' | 'gray' => {
    switch (status) {
      case 'PAID':
        return 'green'
      case 'PARTIALLY_PAID':
        return 'yellow'
      case 'UNPAID':
        return 'red'
      default:
        return 'gray'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'Plaćeno'
      case 'PARTIALLY_PAID':
        return 'Djelomično plaćeno'
      case 'UNPAID':
        return 'Neplaćeno'
      default:
        return status
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'INCOMING_SUPPLIER':
        return 'Ulazni (Dobavljač)'
      case 'OUTGOING_SUPPLIER':
        return 'Izlazni (Dobavljač)'
      case 'INCOMING_INVESTMENT':
        return 'Ulazni (Kupac)'
      case 'OUTGOING_SALES':
        return 'Izlazni (Kupac)'
      default:
        return type
    }
  }

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'PAID') return false
    return new Date(dueDate) < new Date()
  }

  return (
    <Modal show={isOpen && !!contract} onClose={onClose} size="full">
      <Modal.Header
        title={`Računi - ${contract?.contract_number || ''}`}
        subtitle={`Iznos ugovora: €${contract?.contract_amount.toLocaleString('hr-HR')} | Plaćeno: €${contract?.budget_realized.toLocaleString('hr-HR')}`}
        onClose={onClose}
      />
      <Modal.Body>
        {loading ? (
          <LoadingSpinner />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nema računa za ovaj ugovor"
          />
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className={`bg-white border-2 rounded-lg p-6 hover:shadow-md transition-shadow ${
                  isOverdue(invoice.due_date, invoice.status) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-500 uppercase">Broj računa</label>
                      <Badge variant={getStatusBadgeVariant(invoice.status)} size="sm">
                        {getStatusLabel(invoice.status)}
                      </Badge>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{invoice.invoice_number}</p>
                    <p className="text-xs text-gray-500 mt-1">{getTypeLabel(invoice.invoice_type)}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Firma</label>
                    <div className="flex items-center mb-2">
                      <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                      <p className="text-sm font-medium text-gray-900">{invoice.company_name}</p>
                    </div>
                    {invoice.supplier_name && (
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-blue-600 mr-2" />
                        <p className="text-xs text-blue-600">{invoice.supplier_name}</p>
                      </div>
                    )}
                    {invoice.customer_name && (
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-green-600 mr-2" />
                        <p className="text-xs text-green-600">{invoice.customer_name}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Ukupan iznos</label>
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 text-gray-400 mr-1" />
                      <p className="text-lg font-bold text-gray-900">
                        €{invoice.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {invoice.status !== 'UNPAID' && (
                      <p className="text-xs text-green-600 mt-1">
                        Plaćeno: €{invoice.paid_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    {invoice.remaining_amount > 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Preostalo: €{invoice.remaining_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Dospijeće</label>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <p className={`text-sm font-medium ${
                        isOverdue(invoice.due_date, invoice.status) ? 'text-red-600 font-bold' : 'text-gray-900'
                      }`}>
                        {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                      </p>
                    </div>
                    {isOverdue(invoice.due_date, invoice.status) && (
                      <div className="flex items-center mt-1 text-red-600">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        <span className="text-xs font-semibold">KASNI</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Izdano: {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                    </p>
                  </div>
                </div>

                {invoice.description && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Opis</label>
                    <p className="text-sm text-gray-700">{invoice.description}</p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Osnovica:</span>
                    <span className="ml-2 font-medium">€{invoice.base_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">PDV:</span>
                    <span className="ml-2 font-medium">€{invoice.vat_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between items-center w-full">
          <div className="text-sm text-gray-600">
            Ukupno računa: <span className="font-semibold">{invoices.length}</span>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Zatvori
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  )
}
