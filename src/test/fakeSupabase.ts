/**
 * A fake Supabase client for service tests. `from(table)` reads the rows of `db.tables[table]`,
 * and the filters the services use narrow them the way PostgREST would:
 *
 * - `eq`, `neq`, `in`, `gte`, `lte` and `not(column, 'is', null)` compare a column, which may be a
 *   dotted path into an embedded row (`'invoice.invoice_type'`), as a filter on an `!inner` join
 *   is written. A fixture row carries its embedded rows already, under the name the query uses.
 * - `order` sorts, nulls last when ascending and first when descending (Postgres' default), and
 *   `range` slices, so `fetchAllRows` pages through a table.
 * - `single` and `maybeSingle` answer one row.
 * - `select`'s column list is ignored: a fixture row holds what the query would return.
 *
 * A table named in `db.failing` answers every read the way supabase-js reports a failed request,
 * `{ data: null, error }`; one named in `db.failingIn` fails only reads narrowed with `in`, the
 * lookups a service makes after its first batch.
 *
 * Use it from a `vi.mock` factory, with `db` from `vi.hoisted`, and reset `db` in `beforeEach`.
 */
export interface FakeDb {
  tables: Record<string, unknown[]>
  failing: Record<string, string>
  failingIn: Record<string, string>
}

type Row = Record<string, unknown>

const valueAt = (row: Row, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => (value == null ? undefined : (value as Row)[key]), row)

const compare = (a: unknown, b: unknown): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

class FakeQuery implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private filters: Array<(row: Row) => boolean> = []
  private sorts: Array<{ column: string; ascending: boolean }> = []
  private narrowedWithIn = false
  private shape: 'many' | 'single' | 'maybeSingle' = 'many'
  private window: [number, number] | null = null

  constructor(private readonly db: FakeDb, private readonly table: string) {}

  select(): this { return this }
  eq(column: string, value: unknown): this { return this.where(row => valueAt(row, column) === value) }
  neq(column: string, value: unknown): this { return this.where(row => valueAt(row, column) !== value) }
  gte(column: string, value: unknown): this { return this.where(row => valueAt(row, column) != null && compare(valueAt(row, column), value) >= 0) }
  lte(column: string, value: unknown): this { return this.where(row => valueAt(row, column) != null && compare(valueAt(row, column), value) <= 0) }
  in(column: string, values: readonly unknown[]): this {
    this.narrowedWithIn = true
    return this.where(row => values.includes(valueAt(row, column)))
  }
  not(column: string, operator: string, value: unknown): this {
    if (operator !== 'is' || value !== null) throw new Error(`fakeSupabase: not(${column}, ${operator}, …) is not supported`)
    return this.where(row => valueAt(row, column) != null)
  }
  order(column: string, options: { ascending?: boolean } = {}): this {
    this.sorts.push({ column, ascending: options.ascending ?? true })
    return this
  }
  range(from: number, to: number): this { this.window = [from, to]; return this }
  returns(): this { return this }
  single(): this { this.shape = 'single'; return this }
  maybeSingle(): this { this.shape = 'maybeSingle'; return this }

  then<A = { data: unknown; error: { message: string } | null }, B = never>(
    resolve?: ((value: { data: unknown; error: { message: string } | null }) => A | PromiseLike<A>) | null,
    reject?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(resolve, reject)
  }

  private where(test: (row: Row) => boolean): this {
    this.filters.push(test)
    return this
  }

  private run(): { data: unknown; error: { message: string } | null } {
    const message = this.db.failing[this.table] ?? (this.narrowedWithIn ? this.db.failingIn[this.table] : undefined)
    if (message) return { data: null, error: { message } }

    let rows = ((this.db.tables[this.table] ?? []) as Row[]).filter(row => this.filters.every(test => test(row)))
    for (const { column, ascending } of [...this.sorts].reverse()) {
      rows = [...rows].sort((a, b) => {
        const x = valueAt(a, column)
        const y = valueAt(b, column)
        if (x == null && y == null) return 0
        if (x == null) return ascending ? 1 : -1
        if (y == null) return ascending ? -1 : 1
        return ascending ? compare(x, y) : compare(y, x)
      })
    }

    if (this.window) rows = rows.slice(this.window[0], this.window[1] + 1)
    if (this.shape === 'many') return { data: rows, error: null }
    if (rows.length === 1) return { data: rows[0], error: null }
    if (rows.length === 0 && this.shape === 'maybeSingle') return { data: null, error: null }
    return { data: null, error: { message: `JSON object requested, multiple (or no) rows returned (${rows.length})` } }
  }
}

export const emptyFakeDb = (): FakeDb => ({ tables: {}, failing: {}, failingIn: {} })

export const fakeSupabase = (db: FakeDb) => ({
  from: (table: string) => new FakeQuery(db, table),
})
