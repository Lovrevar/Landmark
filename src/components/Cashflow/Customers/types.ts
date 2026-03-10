export interface Customer {
  id: string
  name: string
  surname: string
  email: string | null
  phone: string | null
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES'
  total_amount: number
  paid_amount: number
  remaining_amount: number
  status: string
  issue_date: string
  company?: { name: string }
}

export interface Property {
  apartment_price: number
  garage_price: number | null
  repository_price: number | null
  total_property_price: number
}

export interface CustomerStats {
  id: string
  name: string
  surname: string
  full_name: string
  email: string | null
  phone: string | null
  total_invoices: number
  total_amount: number
  total_paid: number
  total_unpaid: number
  property_price: number
  total_apartments: number
  invoices: Invoice[]
}

export interface TotalStats {
  total_invoices: number
  total_property_value: number
  total_paid: number
  total_debt: number
}
