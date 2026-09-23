// In-memory stand-in for the three Supabase services ai-chat talks to:
// GoTrue (`/auth/v1/user`), PostgREST (`/rest/v1/*`) and Storage
// (`/storage/v1/object/*`).
//
// It speaks HTTP, not a client API. The real supabase-js / postgrest-js in the
// function under test build real requests against SUPABASE_URL and this class
// answers them. That keeps the characterisation honest: what is pinned is what
// the orchestrator actually sends, with no seam in index.ts.
//
// The PostgREST subset implemented is exactly what ai-chat and its tool
// handlers use (checked against postgrest-js 2.106.1): column and `*`
// selects; many-to-one embeds by relation name, FK column or FK hint, with
// `!inner`; filters eq/neq/gt/gte/lt/lte/like/ilike/is/in, `not.` negation,
// embedded filters (`alias.col`) and `or=(...)`; order with nulls first/last;
// limit/offset; `Prefer: count=exact` (+ HEAD); `vnd.pgrst.object+json`
// (single); insert / update / delete with `return=representation`; and RPCs
// registered by the test.

export type Row = Record<string, unknown>

// Many-to-one foreign keys: table -> fk column -> referenced table. Taken from
// the generated types, plus contracts.classification_id, which exists in the
// migrations (20260908120000_cost_classifications.sql) but not yet in the
// generated Relationships.
const FKS: Record<string, Record<string, string>> = {
  contracts: {
    subcontractor_id: 'subcontractors',
    phase_id: 'project_phases',
    classification_id: 'cost_classifications',
    project_id: 'projects',
  },
  accounting_payments: { invoice_id: 'accounting_invoices' },
  accounting_invoices: {
    supplier_id: 'subcontractors',
    project_id: 'projects',
    contract_id: 'contracts',
    company_id: 'accounting_companies',
  },
  project_managers: { project_id: 'projects', user_id: 'users' },
  ai_messages: { session_id: 'ai_sessions', parent_id: 'ai_messages' },
  ai_sessions: { user_id: 'users', summary_through_message_id: 'ai_messages' },
  project_phases: { project_id: 'projects' },
  document_associations: { document_id: 'documents' },
}

// Column defaults applied on insert, mirroring the DDL of the AI chat tables.
const DEFAULTS: Record<string, Row> = {
  ai_sessions: {
    title: null,
    cancel_requested_at: null,
    context_summary: null,
    summary_through_message_id: null,
  },
  ai_messages: { model: null, input_tokens: null, output_tokens: null, stop_reason: null, parent_id: null },
}

export interface RecordedRequest {
  method: string
  service: 'auth' | 'rest' | 'rpc' | 'storage'
  table: string // table, rpc name, or storage bucket
  params: URLSearchParams
  body: unknown
  headers: Headers
  /** Set once the response has been produced. Lets a test tell whether one
   * request completed before another started (sequential vs parallel). */
  finished: boolean
}

type FaultResponse = { status: number; body?: unknown } | { hang: true }
interface Fault {
  match: (r: RecordedRequest) => boolean
  response: FaultResponse
  remaining: number
}

type SelectNode =
  | { kind: 'star' }
  | { kind: 'col'; name: string; alias: string }
  | { kind: 'embed'; alias: string; rel: string; hint: string | null; inner: boolean; children: SelectNode[] }

interface Cond {
  col: string
  op: string
  arg: string
  negate: boolean
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {}
  /** token -> auth user. A token not in this map is rejected by `/auth/v1/user`. */
  authUsers: Record<string, { id: string; email: string }> = {}
  storage: Record<string, Uint8Array<ArrayBuffer>> = {}
  rpcs: Record<string, (args: Row) => unknown> = {}
  requests: RecordedRequest[] = []
  private faults: Fault[] = []
  private hooks: Array<(r: RecordedRequest) => void> = []
  private lastTs = 0

  reset(): void {
    this.tables = {}
    this.authUsers = {}
    this.storage = {}
    this.rpcs = {}
    this.requests = []
    this.faults = []
    this.hooks = []
  }

  /** Monotonic, close-to-real timestamps. Rate-limit windows and the cancel
   * beacon compare against the real clock, and the active-branch rule breaks
   * ties on created_at, so two rows must never share one. */
  now(): string {
    const t = Math.max(Date.now(), this.lastTs + 1)
    this.lastTs = t
    return new Date(t).toISOString()
  }

  seed(table: string, rows: Row[]): void {
    this.tables[table] ??= []
    for (const r of rows) {
      this.tables[table].push({
        ...(DEFAULTS[table] ?? {}),
        id: r.id ?? crypto.randomUUID(),
        created_at: r.created_at ?? this.now(),
        ...r,
      })
    }
  }

  rows(table: string): Row[] {
    return this.tables[table] ?? []
  }

  /** Fail the next `times` requests matching `match` with the given response,
   * or with `{ hang: true }` never answer them (for timeout paths). */
  fault(match: (r: RecordedRequest) => boolean, response: FaultResponse, times = 1): void {
    this.faults.push({ match, response, remaining: times })
  }

  /** Run a side effect when a request arrives, before it is served. Used to
   * change state mid-request, e.g. writing the cancel beacon while a tool runs. */
  onRequest(hook: (r: RecordedRequest) => void): void {
    this.hooks.push(hook)
  }

  requestsTo(table: string, method?: string): RecordedRequest[] {
    return this.requests.filter((r) => r.table === table && (!method || r.method === method))
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const text = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text()
    let body: unknown = null
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }
    const path = url.pathname
    let service: RecordedRequest['service']
    let name: string
    if (path.startsWith('/auth/v1/')) {
      service = 'auth'
      name = path.slice('/auth/v1/'.length)
    } else if (path.startsWith('/rest/v1/rpc/')) {
      service = 'rpc'
      name = path.slice('/rest/v1/rpc/'.length)
    } else if (path.startsWith('/rest/v1/')) {
      service = 'rest'
      name = path.slice('/rest/v1/'.length)
    } else if (path.startsWith('/storage/v1/object/')) {
      service = 'storage'
      name = path.slice('/storage/v1/object/'.length).split('/')[0]
    } else {
      return json(404, { message: `fake-supabase: no route for ${path}` })
    }

    const rec: RecordedRequest = { method: req.method, service, table: name, params: url.searchParams, body, headers: req.headers, finished: false }
    this.requests.push(rec)
    for (const h of this.hooks) h(rec)
    try {
      return await this.serve(rec, req, url, path, service, name, body)
    } finally {
      rec.finished = true
    }
  }

  private async serve(
    rec: RecordedRequest,
    req: Request,
    url: URL,
    path: string,
    service: RecordedRequest['service'],
    name: string,
    body: unknown,
  ): Promise<Response> {

    const fault = this.faults.find((f) => f.remaining > 0 && f.match(rec))
    if (fault) {
      fault.remaining--
      if ('hang' in fault.response) return await new Promise<Response>(() => {})
      return json(fault.response.status, fault.response.body ?? { code: 'XX000', message: 'injected fault', details: null, hint: null })
    }

    switch (service) {
      case 'auth':
        return this.handleAuth(req)
      case 'rpc': {
        const fn = this.rpcs[name]
        if (!fn) return json(404, { code: 'PGRST202', message: `Could not find the function public.${name}` })
        return json(200, fn((body ?? {}) as Row))
      }
      case 'storage':
        return this.handleStorage(req.method, path.slice('/storage/v1/object/'.length), body)
      case 'rest':
        return this.handleRest(req, name, url.searchParams, body)
    }
  }

  private handleAuth(req: Request): Response {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const user = this.authUsers[token]
    if (!user) return json(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' })
    return json(200, {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    })
  }

  private handleStorage(method: string, rest: string, body: unknown): Response {
    const [bucket, ...parts] = rest.split('/')
    if (method === 'GET') {
      const bytes = this.storage[`${bucket}/${parts.join('/')}`]
      if (!bytes) return json(400, { statusCode: '404', error: 'not_found', message: 'Object not found' })
      return new Response(bytes, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
    }
    if (method === 'DELETE') {
      const prefixes = ((body as { prefixes?: string[] })?.prefixes) ?? []
      for (const p of prefixes) delete this.storage[`${bucket}/${p}`]
      return json(200, [])
    }
    return json(405, { message: 'fake-supabase: storage method not supported' })
  }

  private handleRest(req: Request, table: string, params: URLSearchParams, body: unknown): Response {
    const prefer = req.headers.get('Prefer') ?? ''
    const wantsObject = (req.headers.get('Accept') ?? '').includes('vnd.pgrst.object+json')
    const wantsCount = /count=exact/.test(prefer)
    const returnRep = /return=representation/.test(prefer)
    let select: SelectNode[]
    try {
      select = parseSelect(params.get('select') ?? '*')
    } catch (e) {
      return json(400, { code: 'PGRST100', message: (e as Error).message })
    }
    const { base, embedded, or } = parseFilters(params)
    this.tables[table] ??= []

    try {
      switch (req.method) {
        case 'GET':
        case 'HEAD': {
          let matched = this.tables[table]
            .filter((r) => base.every((c) => evalCond(r, c)) && (or.length === 0 || or.some((c) => evalCond(r, c))))
            .map((r) => ({ base: r, out: this.project(table, r, select, embedded) }))
            .filter((x) => x.out !== null) as Array<{ base: Row; out: Row }>
          matched = order(matched, params.get('order'))
          const total = matched.length
          const offset = Number(params.get('offset') ?? 0)
          const limit = params.get('limit') !== null ? Number(params.get('limit')) : Infinity
          const page = matched.slice(offset, offset + limit).map((x) => x.out)
          const headers: Record<string, string> = {}
          if (wantsCount) headers['content-range'] = page.length ? `${offset}-${offset + page.length - 1}/${total}` : `*/${total}`
          if (req.method === 'HEAD') return new Response(null, { status: 200, headers })
          return this.respond(page, wantsObject, headers)
        }
        case 'POST': {
          const input = Array.isArray(body) ? body : [body]
          const inserted: Row[] = []
          for (const raw of input as Row[]) {
            const row: Row = { ...(DEFAULTS[table] ?? {}), id: crypto.randomUUID(), created_at: this.now(), ...raw }
            if (this.tables[table].some((r) => r.id === row.id)) {
              return json(409, { code: '23505', message: `duplicate key value violates unique constraint "${table}_pkey"`, details: null, hint: null })
            }
            this.tables[table].push(row)
            inserted.push(row)
          }
          if (!returnRep) return new Response(null, { status: 201 })
          return this.respond(inserted.map((r) => this.project(table, r, select, embedded)!), wantsObject, {}, 201)
        }
        case 'PATCH': {
          const hit = this.tables[table].filter((r) => base.every((c) => evalCond(r, c)))
          for (const r of hit) Object.assign(r, body as Row, 'updated_at' in r ? { updated_at: this.now() } : {})
          if (!returnRep) return new Response(null, { status: 204 })
          return this.respond(hit.map((r) => this.project(table, r, select, embedded)!), wantsObject)
        }
        case 'DELETE': {
          const keep = this.tables[table].filter((r) => !base.every((c) => evalCond(r, c)))
          this.tables[table] = keep
          return new Response(null, { status: 204 })
        }
      }
    } catch (e) {
      return json(400, { code: 'PGRST200', message: (e as Error).message, details: null, hint: null })
    }
    return json(405, { message: 'fake-supabase: method not supported' })
  }

  private respond(rows: Row[], wantsObject: boolean, headers: Record<string, string> = {}, status = 200): Response {
    if (wantsObject) {
      if (rows.length !== 1) {
        return json(406, {
          code: 'PGRST116',
          details: `The result contains ${rows.length} rows`,
          hint: null,
          message: 'JSON object requested, multiple (or no) rows returned',
        })
      }
      return json(status, rows[0], headers)
    }
    return json(status, rows, headers)
  }

  /** Project one row through the select tree. Returns null when an `!inner`
   * embed is missing (or fails its embedded filters): PostgREST drops that row. */
  private project(table: string, row: Row, nodes: SelectNode[], embedded: Map<string, Cond[]>): Row | null {
    const out: Row = {}
    for (const n of nodes) {
      if (n.kind === 'star') Object.assign(out, row)
      else if (n.kind === 'col') out[n.alias] = row[n.name] ?? null
      else {
        const { fkCol, target } = resolveRelation(table, n)
        let child: Row | null = (this.tables[target] ?? []).find((r) => r.id === row[fkCol]) ?? null
        const conds = [...(embedded.get(n.alias) ?? []), ...(n.alias !== n.rel ? embedded.get(n.rel) ?? [] : [])]
        if (child && !conds.every((c) => evalCond(child!, c))) child = null
        if (!child && n.inner) return null
        out[n.alias] = child ? this.project(target, child, n.children, new Map()) : null
      }
    }
    return out
  }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let quoted = false
  let cur = ''
  for (const ch of s) {
    if (ch === '"') quoted = !quoted
    if (!quoted && ch === '(') depth++
    if (!quoted && ch === ')') depth--
    if (!quoted && depth === 0 && ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

function parseSelect(s: string): SelectNode[] {
  return splitTopLevel(s).map((item) => {
    if (item === '*') return { kind: 'star' } as const
    const embed = item.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?\((.*)\)$/s)
    if (embed) {
      const [, alias, rel, hint, inner] = embed
      return {
        kind: 'embed',
        alias: alias ?? rel,
        rel,
        hint: hint && hint !== 'inner' ? hint : null,
        inner: hint === 'inner',
        children: parseSelect(inner || '*'),
      } as const
    }
    const col = item.match(/^(?:(\w+):)?(\w+)$/)
    if (!col) throw new Error(`fake-supabase: unsupported select item "${item}"`)
    return { kind: 'col', alias: col[1] ?? col[2], name: col[2] } as const
  })
}

function resolveRelation(table: string, n: Extract<SelectNode, { kind: 'embed' }>): { fkCol: string; target: string } {
  const fks = FKS[table] ?? {}
  if (fks[n.rel]) return { fkCol: n.rel, target: fks[n.rel] } // embedded via FK column, e.g. projects:project_id(name)
  if (n.hint) {
    const col = n.hint.replace(new RegExp(`^${table}_`), '').replace(/_fkey$/, '')
    if (fks[col] !== n.rel) throw new Error(`fake-supabase: hint ${n.hint} does not link ${table} to ${n.rel}`)
    return { fkCol: col, target: n.rel }
  }
  const candidates = Object.entries(fks).filter(([, t]) => t === n.rel)
  if (candidates.length !== 1) {
    throw new Error(`fake-supabase: cannot resolve relationship ${table} -> ${n.rel} (${candidates.length} candidates)`)
  }
  return { fkCol: candidates[0][0], target: n.rel }
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'])

function parseCond(col: string, expr: string): Cond {
  let negate = false
  if (expr.startsWith('not.')) {
    negate = true
    expr = expr.slice(4)
  }
  const dot = expr.indexOf('.')
  return { col, op: expr.slice(0, dot), arg: expr.slice(dot + 1), negate }
}

function parseFilters(params: URLSearchParams): { base: Cond[]; embedded: Map<string, Cond[]>; or: Cond[] } {
  const base: Cond[] = []
  const embedded = new Map<string, Cond[]>()
  let or: Cond[] = []
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue
    if (key === 'or') {
      or = splitTopLevel(value.replace(/^\(|\)$/g, '')).map((part) => {
        const [col, ...rest] = part.split('.')
        return parseCond(col, rest.join('.'))
      })
      continue
    }
    if (key.includes('.')) {
      const [alias, col] = key.split('.', 2)
      if (!embedded.has(alias)) embedded.set(alias, [])
      embedded.get(alias)!.push(parseCond(col, value))
    } else base.push(parseCond(key, value))
  }
  return { base, embedded, or }
}

function likeToRegex(pattern: string, flags: string): RegExp {
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '\\' && i + 1 < pattern.length) {
      re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    } else if (ch === '%' || ch === '*') re += '.*'
    else if (ch === '_') re += '.'
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`, flags)
}

function cmp(a: unknown, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (a !== null && a !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
  return String(a) < b ? -1 : String(a) > b ? 1 : 0
}

function evalCond(row: Row, c: Cond): boolean {
  const v = row[c.col]
  let r: boolean
  switch (c.op) {
    case 'eq':
      r = v !== null && v !== undefined && String(v) === c.arg
      break
    case 'neq':
      r = v !== null && v !== undefined && String(v) !== c.arg
      break
    case 'gt':
      r = v != null && cmp(v, c.arg) > 0
      break
    case 'gte':
      r = v != null && cmp(v, c.arg) >= 0
      break
    case 'lt':
      r = v != null && cmp(v, c.arg) < 0
      break
    case 'lte':
      r = v != null && cmp(v, c.arg) <= 0
      break
    case 'like':
      r = v != null && likeToRegex(c.arg, 's').test(String(v))
      break
    case 'ilike':
      r = v != null && likeToRegex(c.arg, 'is').test(String(v))
      break
    case 'is':
      r = c.arg === 'null' ? v === null || v === undefined : String(v) === c.arg
      break
    case 'in': {
      const list = splitTopLevel(c.arg.replace(/^\(|\)$/g, '')).map((x) => x.replace(/^"|"$/g, ''))
      r = v != null && list.includes(String(v))
      break
    }
    default:
      throw new Error(`fake-supabase: unsupported operator "${c.op}"`)
  }
  return c.negate ? !r : r
}

function order<T extends { base: Row }>(rows: T[], spec: string | null): T[] {
  if (!spec) return rows
  const keys = spec.split(',').map((part) => {
    const [col, ...mods] = part.split('.')
    const desc = mods.includes('desc')
    const nullsFirst = mods.includes('nullsfirst') ? true : mods.includes('nullslast') ? false : desc
    return { col, desc, nullsFirst }
  })
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const av = a.base[k.col]
      const bv = b.base[k.col]
      const an = av === null || av === undefined
      const bn = bv === null || bv === undefined
      if (an && bn) continue
      if (an) return k.nullsFirst ? -1 : 1
      if (bn) return k.nullsFirst ? 1 : -1
      const d = cmp(av, String(bv))
      if (d !== 0) return k.desc ? -d : d
    }
    return 0
  })
}
