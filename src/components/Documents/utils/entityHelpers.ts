import type { SearchableOption } from '../../ui/SearchableSelect'
import type { DocumentAssociation, EntityType } from '../types'

export interface EntityLookups {
  project: SearchableOption[]
  subcontractor: SearchableOption[]
  phase: SearchableOption[]
  contract: SearchableOption[]
  credit: SearchableOption[]
}

export function badgeVariantForType(type: EntityType): 'blue' | 'purple' | 'teal' | 'orange' | 'gray' {
  switch (type) {
    case 'project':       return 'blue'
    case 'subcontractor': return 'purple'
    case 'contract':      return 'teal'
    case 'unit':          return 'orange'
    case 'customer':      return 'orange'
    default:              return 'gray'
  }
}

export function resolveEntityLabel(a: DocumentAssociation, lookups: EntityLookups): string {
  const fallback = a.entity_id.slice(0, 8)
  switch (a.entity_type) {
    case 'project':       return lookups.project      .find(o => o.value === a.entity_id)?.label ?? fallback
    case 'subcontractor': return lookups.subcontractor.find(o => o.value === a.entity_id)?.label ?? fallback
    case 'phase':         return lookups.phase        .find(o => o.value === a.entity_id)?.label ?? fallback
    case 'contract':      return lookups.contract     .find(o => o.value === a.entity_id)?.label ?? fallback
    case 'credit':        return lookups.credit       .find(o => o.value === a.entity_id)?.label ?? fallback
    default:              return fallback
  }
}
