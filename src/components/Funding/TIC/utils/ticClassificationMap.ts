/**
 * Default mapping from a TIC investment line name to a cost classification.
 *
 * Mirrored in the backfill in
 * supabase/migrations/20260909130000_tic_budget_source.sql. That migration runs once and then
 * never again, so this file plus its test is what keeps the mapping honest afterwards — and it
 * is also what classifies rows arriving from an Excel import, which happens continuously.
 * Keep the two in sync: a name added here must be added there, and vice versa.
 *
 * These are DEFAULTS, not rules. The mapping is stored per line item and editable per project in
 * the TIC table, so a project that treats (say) Konzalting as preparation rather than control
 * just changes it there. That is why an imperfect default is acceptable here in a way it would
 * not be for the migration's phase fold, which was irreversible.
 */

/** Stable slugs matching cost_classifications.code for the seven seeded rows. */
export type ClassificationCode =
  | 'zemljiste'
  | 'priprema_i_razvoj'
  | 'izgradnja_i_uredenje'
  | 'opremanje'
  | 'kontrola'
  | 'financiranje_i_nadzor'
  | 'nepredvideni_troskovi'

/**
 * The 16 canonical INVESTICIJA rows from `defaultLineItems`.
 *
 * Verified against every TIC record in production: all 16 names are present in the stored data
 * and every one maps, so the backfill leaves no row unclassified.
 */
const TIC_LINE_CLASSIFICATIONS: Record<string, ClassificationCode> = {
  // Land and the tax that comes with acquiring it.
  'vrijednost zemljišta': 'zemljiste',
  'porez na promet nekretnina': 'zemljiste',

  // Everything spent before building starts: design, permits, utility connections.
  'priprema projekta': 'priprema_i_razvoj',
  'projektna dokumentacija, geodetske usluge': 'priprema_i_razvoj',
  'komunalni i vodni doprinos': 'priprema_i_razvoj',
  'priključci': 'priprema_i_razvoj',

  // The build itself. "Građenje" is the line the GRAĐENJE tab breaks down.
  'građenje': 'izgradnja_i_uredenje',
  'unutarnje uređenje': 'izgradnja_i_uredenje',

  'opremanje (namještaj, bijela tehnika)': 'opremanje',

  // Oversight and the paperwork that closes a project out.
  'stručni nadzor': 'kontrola',
  'konzalting': 'kontrola',
  'uknjižba, etažiranje, uporabna dozvola': 'kontrola',

  // Cost of money, and of selling the result.
  'posredovanje, marketing, osiguranje': 'financiranje_i_nadzor',
  'financijski nadzor': 'financiranje_i_nadzor',
  'financiranje': 'financiranje_i_nadzor',

  'nepredviđeni troškovi': 'nepredvideni_troskovi',
}

/**
 * The default classification for a TIC line name, or null when the name is not one of the
 * canonical rows.
 *
 * Trimmed and lowercased before matching, so a hand-edited label with stray casing or padding
 * still resolves. Deliberately not accent-insensitive and not fuzzy: a wrong guess here files
 * money under the wrong heading, and an unmapped row is visible in the UI whereas a
 * confidently-wrong one is not.
 */
export function defaultClassificationForLine(lineName: string): ClassificationCode | null {
  return TIC_LINE_CLASSIFICATIONS[lineName.trim().toLowerCase()] ?? null
}

/** The canonical line names, exposed so the test can assert full coverage. */
export const CANONICAL_TIC_LINE_NAMES = Object.keys(TIC_LINE_CLASSIFICATIONS)

/**
 * Fill in a default classification on any line that does not already have one.
 *
 * Used when rows arrive from outside the editor — an Excel import, or the starting template for
 * a project with no TIC yet. Without this, importing a workbook would replace every row with a
 * freshly parsed one carrying no classification, silently emptying the per-classification totals
 * and any phase budget populated from them.
 *
 * An existing `classification_id` is never overwritten, including a deliberate `null`: once
 * someone has classified a row (or decided to leave it unclassified), a later import must not
 * quietly reassign it.
 */
export function applyDefaultClassifications<T extends { name: string; classification_id?: number | null }>(
  lineItems: T[],
  classifications: Array<{ id: number; code: string | null }>
): T[] {
  const idByCode = new Map<string, number>()
  for (const c of classifications) {
    if (c.code) idByCode.set(c.code, c.id)
  }

  return lineItems.map(item => {
    if (item.classification_id !== undefined) return item
    const code = defaultClassificationForLine(item.name)
    return { ...item, classification_id: code ? idByCode.get(code) ?? null : null }
  })
}
