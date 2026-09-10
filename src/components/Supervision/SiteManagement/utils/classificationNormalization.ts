/**
 * TypeScript mirror of the normalisation map in
 * supabase/migrations/20260908120200_split_phase_classification.sql.
 *
 * That migration folds the old classification-shaped `project_phases.phase_name` values onto
 * `contracts.classification_id`. Once it has run the SQL is never executed again, so this file
 * plus its test is what keeps its most fragile assumption — that every spelling users typed maps
 * to the right bucket — under CI.
 *
 * Keep the two in sync. If a spelling is added here, add it there too (and vice versa).
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

const LEGACY_PHASE_NAMES: Record<string, ClassificationCode> = {
  'priprema i razvoj': 'priprema_i_razvoj',
  'zemljište': 'zemljiste',
  'kupoprodaja zemljišta': 'zemljiste',
  'izgradnja i uređenje': 'izgradnja_i_uredenje',
  'izgradnja': 'izgradnja_i_uredenje',
  'opremanje': 'opremanje',
  'kontrola': 'kontrola',
  'financiranje i nadzor': 'financiranje_i_nadzor',
  'nadzor i financiranje': 'financiranje_i_nadzor',
  'nepredviđeni troškovi': 'nepredvideni_troskovi'
}

/**
 * Maps a legacy phase name to the cost classification it was standing in for, or null when the
 * name is a real phase name and must be left alone.
 *
 * Trims and lowercases before matching: production carried four rows with stray leading or
 * trailing spaces, and casing drifted ("Priprema i Razvoj", "Nepredviđeni Troškovi").
 * Deliberately not accent-insensitive — enumerating the observed spellings is auditable in a way
 * a fuzzy match is not, and a wrong guess here silently misfiles money.
 */
export function normalizeLegacyPhaseName(phaseName: string): ClassificationCode | null {
  return LEGACY_PHASE_NAMES[phaseName.trim().toLowerCase()] ?? null
}
