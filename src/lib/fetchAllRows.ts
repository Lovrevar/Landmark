import type { PostgrestError } from '@supabase/supabase-js'

/** PostgREST's default `max-rows`: a request never returns more, and says nothing when it cuts. */
export const POSTGREST_PAGE_SIZE = 1000

/**
 * Reads every row of a query that can outgrow one PostgREST page.
 *
 * `page(from, to)` builds the query for one page and must end in `.range(from, to)` with an
 * order that is stable across requests (finish it with a unique column such as `id`), or rows
 * can repeat or go missing between pages. Throws on the first failed page — a partial list must
 * not pass for the whole one.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize = POSTGREST_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw error
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) return rows
  }
}
