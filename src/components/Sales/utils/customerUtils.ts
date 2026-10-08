import { CustomerWithApartments } from '../Customers/types'
import { unitPackageTotal } from './packageTotal'

type UnitItem = {
  id: string
  type?: string
  price?: number
  sale_price?: number
  project_name?: string
  total_paid?: number
  garage?: { price: number; number: string } | null
  repository?: { price: number; number: string } | null
  floor?: number
  size_m2?: number
  number?: string
  sale_date?: string
}

export interface ProjectGroup {
  units: UnitItem[]
  projectTotal: number
  projectPaid: number
  projectRemaining: number
}

export function groupCustomerPurchasesByProject(customer: CustomerWithApartments): Record<string, ProjectGroup> {
  if (!customer.apartments) return {}

  const groups: Record<string, UnitItem[]> = customer.apartments.reduce(
    (acc: Record<string, UnitItem[]>, unit: UnitItem) => {
      const projectName = unit.project_name || 'Standalone Units'
      if (!acc[projectName]) {
        acc[projectName] = []
      }
      acc[projectName].push(unit)
      return acc
    },
    {}
  )

  const result: Record<string, ProjectGroup> = {}
  for (const [projectName, units] of Object.entries(groups)) {
    // The shared package total, so the per-project sum agrees with the rows under it (SALES-6).
    const projectTotal = units.reduce((sum: number, u: UnitItem) => sum + unitPackageTotal(u), 0)
    const projectPaid = units.reduce((sum: number, u: UnitItem) => sum + (u.total_paid || 0), 0)
    const projectRemaining = projectTotal - projectPaid
    result[projectName] = { units, projectTotal, projectPaid, projectRemaining }
  }

  return result
}
