import * as XLSX from '@e965/xlsx'
import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { parseNumber } from '../../../../utils/excelParsers'
import { importErrorMessage } from '../importOutcome'

export interface GarageImportError {
  /** The garage label from the file's first column. */
  number: string
  message: string
}

export interface ImportResult {
  updated: number
  created: number
  errors: GarageImportError[]
}

interface ParsedGarageRow {
  number: string
  size_m2: number
  price: number
  exists: boolean
  /** The stored spelling of the number an update has to match. */
  target: string
}

/** The key a garage number is compared by: the unique index ignores case and outer spaces. */
export const garageNumberKey = (number: string): string => number.trim().toLowerCase()

/**
 * Marks each row of a file as an update or an insert, in file order.
 *
 * A number already in the building is an update. So is a number that appeared earlier in the same
 * file: the snapshot of existing numbers was taken once, so a repeated new number used to be
 * inserted twice (SALES-9) — now the first row creates it and the second updates it.
 *
 * `target` is the number as it is stored (or as the earlier row will store it), which is what an
 * update has to match: "g-1" in the file updates the garage saved as "G-1".
 */
export function markExistingGarages<T extends { number: string }>(
  rows: readonly T[],
  existingNumbers: ReadonlySet<string>,
): (T & { exists: boolean; target: string })[] {
  const stored = new Map([...existingNumbers].map(number => [garageNumberKey(number), number]))
  return rows.map(row => {
    const key = garageNumberKey(row.number)
    const known = stored.get(key)
    if (known === undefined) stored.set(key, row.number)
    return { ...row, exists: known !== undefined, target: known ?? row.number }
  })
}

export async function fetchExistingGarageNumbers(buildingId: string): Promise<Set<string>> {
  const { data: existingGarages, error } = await supabase
    .from('garages')
    .select('number')
    .eq('building_id', buildingId)
  // A failed read is not "no garages yet": every row would then be treated as new.
  if (error) throw error
  return new Set(existingGarages?.map(g => g.number) || [])
}

export async function importGaragesFromExcel(file: File, buildingId: string, duplicateMessage?: string): Promise<ImportResult> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  const existingNumbers = await fetchExistingGarageNumbers(buildingId)

  const parsedRows: ParsedGarageRow[] = markExistingGarages(
    rows
      .slice(1)
      .filter(row => row[0])
      .map(row => ({ number: String(row[0]).trim(), size_m2: parseNumber(row[1]), price: parseNumber(row[2]) })),
    existingNumbers,
  )

  let created = 0
  let updated = 0
  const errors: GarageImportError[] = []

  for (const row of parsedRows) {
    try {
      if (row.exists) {
        const { error } = await supabase
          .from('garages')
          .update({ size_m2: row.size_m2, price: row.price })
          .eq('building_id', buildingId)
          .eq('number', row.target)
        if (error) throw error
        updated++
      } else {
        const { error } = await supabase
          .from('garages')
          .insert({
            building_id: buildingId,
            number: row.number,
            size_m2: row.size_m2,
            price: row.price,
            floor: 0,
            status: 'Available'
          })
        if (error) throw error
        created++
      }
    } catch (error) {
      // Supabase errors are plain objects, so `instanceof Error` alone rendered "[object Object]".
      errors.push({ number: row.number, message: importErrorMessage(error, duplicateMessage) })
    }
  }

  logActivity({ action: 'garage.import_excel', entity: 'garage', metadata: { severity: 'high', created_count: created, updated_count: updated, error_count: errors.length } })

  return { created, updated, errors }
}
