import type { Sale } from '../../../lib/supabase'

export interface SalesDashboardStats {
  totalUnits: number
  availableUnits: number
  reservedUnits: number
  soldUnits: number
  totalRevenue: number
  avgSalePrice: number
  salesRate: number
  totalCustomers: number
  activeLeads: number
  /** Cash collected this calendar month on apartment sales invoices (gross, VAT included). */
  monthlyRevenue: number
}

export interface ProjectStats {
  project_id: string
  project_name: string
  total_units: number
  sold_units: number
  reserved_units: number
  available_units: number
  total_revenue: number
  sales_rate: number
}

export interface MonthlyTrend {
  /**
   * The month's first day as `'YYYY-MM-DD'`. It used to be a rendered `'MMM yy'` label, which
   * put an English month on a Croatian dashboard; the service has no translator, so it hands
   * over a key and `SalesDashboard` formats it with `formatMonthYear`.
   */
  month: string
  sales_count: number
  revenue: number
}

export interface RecentSale extends Sale {
  apartment_number: string
  project_name: string
  customer_name: string
}
