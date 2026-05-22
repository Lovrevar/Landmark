// Maps an app route (from React Router's location.pathname) to a stable
// pattern + human-readable Croatian label. Used to build the [Kontekst: ...]
// line that's prepended to user messages in the orchestration loop, and to
// power the route-boost in the help-kb search tool.
//
// Important constraints baked into this file:
//   - We never echo the entity id from a detail route. /projects/:id maps to
//     "detalji projekta" (not "project XYZ"). The whole point of tool-based
//     retrieval is to fetch entity data on demand; leaking it into the prompt
//     context defeats the design.
//   - The PATTERNS array is ordered: more-specific patterns first. Detail
//     routes like /projects/:id must precede the list /projects entry.

export interface RouteDescription {
  /** Normalised pattern (e.g. "/projects/:id"). Used for route-boost matching. */
  pattern: string
  /** Human-readable Croatian label. */
  label: string
}

interface RouteEntry {
  /** Compiled matcher. */
  re: RegExp
  pattern: string
  label: string
}

// Order matters: longer / more specific patterns first.
const PATTERNS: RouteEntry[] = [
  { re: /^\/projects\/[^/]+$/,        pattern: '/projects/:id',          label: 'detalji projekta' },
  { re: /^\/projects$/,               pattern: '/projects',              label: 'Projekti (popis)' },
  { re: /^\/budget-control$/,         pattern: '/budget-control',        label: 'Kontrola proračuna' },
  { re: /^\/subcontractors$/,         pattern: '/subcontractors',        label: 'Podugovaratelji' },
  { re: /^\/site-management$/,        pattern: '/site-management',       label: 'Upravljanje gradilištem' },
  { re: /^\/work-logs$/,              pattern: '/work-logs',             label: 'Radni dnevnik' },
  { re: /^\/payments$/,               pattern: '/payments',              label: 'Upravljanje plaćanjima' },
  { re: /^\/invoices$/,               pattern: '/invoices',              label: 'Projekti — Računi' },
  { re: /^\/sales-projects$/,         pattern: '/sales-projects',        label: 'Prodajni projekti' },
  { re: /^\/apartments$/,             pattern: '/apartments',            label: 'Stanovi' },
  { re: /^\/customers$/,              pattern: '/customers',             label: 'Kupci (prodaja)' },
  { re: /^\/sales-payments$/,         pattern: '/sales-payments',        label: 'Plaćanja prodaje' },
  { re: /^\/sales-reports$/,          pattern: '/sales-reports',         label: 'Izvještaji prodaje' },
  { re: /^\/banks$/,                  pattern: '/banks',                 label: 'Investitori' },
  { re: /^\/investment-projects$/,    pattern: '/investment-projects',   label: 'Projektne investicije' },
  { re: /^\/funding-credits$/,        pattern: '/funding-credits',       label: 'Investicije (krediti)' },
  { re: /^\/funding-payments$/,       pattern: '/funding-payments',      label: 'Uplate financiranja' },
  { re: /^\/tic$/,                    pattern: '/tic',                   label: 'TIC' },
  { re: /^\/accounting-invoices$/,    pattern: '/accounting-invoices',   label: 'Računi (Cashflow)' },
  { re: /^\/accounting-payments$/,    pattern: '/accounting-payments',   label: 'Plaćanja (Cashflow)' },
  { re: /^\/accounting-suppliers$/,   pattern: '/accounting-suppliers',  label: 'Dobavljači (Cashflow)' },
  { re: /^\/office-suppliers$/,       pattern: '/office-suppliers',      label: 'Office Dobavljači' },
  { re: /^\/accounting-companies$/,   pattern: '/accounting-companies',  label: 'Moje firme' },
  { re: /^\/accounting-banks$/,       pattern: '/accounting-banks',      label: 'Banke (Cashflow)' },
  { re: /^\/accounting-customers$/,   pattern: '/accounting-customers',  label: 'Kupci (Cashflow)' },
  { re: /^\/accounting-calendar$/,    pattern: '/accounting-calendar',   label: 'Kalendar dospijeća' },
  { re: /^\/accounting-loans$/,       pattern: '/accounting-loans',      label: 'Pozajmice i prijenosi' },
  { re: /^\/debt-status$/,            pattern: '/debt-status',           label: 'Stanje duga' },
  { re: /^\/accounting-approvals$/,   pattern: '/accounting-approvals',  label: 'Odobrenja' },
  { re: /^\/retail-projects$/,        pattern: '/retail-projects',       label: 'Retail projekti' },
  { re: /^\/retail-land-plots$/,      pattern: '/retail-land-plots',     label: 'Zemljišne čestice' },
  { re: /^\/retail-customers$/,       pattern: '/retail-customers',      label: 'Retail kupci' },
  { re: /^\/retail-sales$/,           pattern: '/retail-sales',          label: 'Retail prodaja' },
  { re: /^\/retail-sales-payments$/,  pattern: '/retail-sales-payments', label: 'Retail prodajna plaćanja' },
  { re: /^\/retail-invoices$/,        pattern: '/retail-invoices',       label: 'Retail računi' },
  { re: /^\/retail-reports$/,         pattern: '/retail-reports',        label: 'Retail izvještaji' },
  { re: /^\/documents$/,              pattern: '/documents',             label: 'Dokumenti' },
  { re: /^\/chat$/,                   pattern: '/chat',                  label: 'Chat (poruke)' },
  { re: /^\/tasks$/,                  pattern: '/tasks',                 label: 'Zadaci' },
  { re: /^\/calendar$/,               pattern: '/calendar',              label: 'Kalendar' },
  { re: /^\/activity-log$/,           pattern: '/activity-log',          label: 'Dnevnik aktivnosti' },
  { re: /^\/general-reports$/,        pattern: '/general-reports',       label: 'Opći izvještaji' },
  { re: /^\/$/,                       pattern: '/',                      label: 'Nadzorna ploča' },
]

const MAX_ROUTE_LENGTH = 200

/**
 * Validate a client-supplied path string. Accepts the canonical "/segment[/seg]"
 * shape; returns the trimmed path or null if it doesn't look like a route.
 * Strips query/hash deliberately — we never want them in the prompt context.
 */
export function sanitizeRoute(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let path = raw.trim()
  if (path.length === 0 || path.length > MAX_ROUTE_LENGTH) return null
  if (!path.startsWith('/')) return null
  const q = path.indexOf('?')
  if (q !== -1) path = path.slice(0, q)
  const h = path.indexOf('#')
  if (h !== -1) path = path.slice(0, h)
  // Reject control chars and whitespace; routes don't contain them.
  // eslint-disable-next-line no-control-regex -- intentionally rejects control chars in routes
  if (/[\s\x00-\x1f]/.test(path)) return null
  return path
}

/**
 * Resolve a (sanitized) route to its pattern + label. Returns null if no
 * matcher fires — the orchestration loop drops the context line in that case
 * rather than guessing a label.
 */
export function describeRoute(path: string): RouteDescription | null {
  for (const entry of PATTERNS) {
    if (entry.re.test(path)) {
      return { pattern: entry.pattern, label: entry.label }
    }
  }
  return null
}
