import { supabase } from './supabase'

/**
 * The name of the organisation this database belongs to, printed on report headers, covers and
 * footers (GEN-19). It used to be "LANDMARK GROUP" in the locale files, so the demo and any other
 * deployment printed the customer's name.
 *
 * It lives in the database (`organization_settings`, one row, set with SQL per database), not in
 * the build: production, LandmarkDemo and dev each carry their own, and one bundle serves all
 * three. Unset, the reports print only their titles.
 */

/** Trims the stored value; a blank one counts as unset. */
export const normalizeOrgName = (raw: string | undefined | null): string | null => {
  const name = raw?.trim()
  return name ? name : null
}

/** Reads the name. Throws on a failed read, like every service: no name is not the same as no answer. */
export async function fetchOrgName(): Promise<string | null> {
  const { data, error } = await supabase.from('organization_settings').select('name').maybeSingle()
  if (error) throw error
  return normalizeOrgName(data?.name)
}

/** The name as report headings print it, in capitals; null when no name is configured. */
export const orgHeading = (name: string | null | undefined): string | null =>
  name ? name.toLocaleUpperCase('hr-HR') : null
