import * as XLSX from '@e965/xlsx'
import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'

export interface ImportResult {
  updated: number
  created: number
  errors: string[]
}

interface ParsedGarageRow {
  number: string
  size_m2: number
  price: number
  exists: boolean
}

export async function fetchExistingGarageNumbers(buildingId: string): Promise<Set<string>> {
  const { data: existingGarages } = await supabase
    .from('garages')
    .select('number')
    .eq('building_id', buildingId)
  return new Set(existingGarages?.map(g => g.number) || [])
}

export async function importGaragesFromExcel(file: File, buildingId: string): Promise<ImportResult> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  const { data: existingGarages } = await supabase
    .from('garages')
    .select('number')
    .eq('building_id', buildingId)

  const existingNumbers = new Set(existingGarages?.map(g => g.number) || [])

  const parsedRows: ParsedGarageRow[] = rows
    .slice(1)
    .filter(row => row[0])
    .map(row => ({
      number: String(row[0]),
      size_m2: Number(row[1]) || 0,
      price: Number(row[2]) || 0,
      exists: existingNumbers.has(String(row[0]))
    }))

  let created = 0
  let updated = 0
  const errors: string[] = []

  for (const row of parsedRows) {
    try {
      if (row.exists) {
        const { error } = await supabase
          .from('garages')
          .update({ size_m2: row.size_m2, price: row.price })
          .eq('building_id', buildingId)
          .eq('number', row.number)
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
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`Garage ${row.number}: ${message}`)
    }
  }

  logActivity({ action: 'garage.import_excel', entity: 'garage', metadata: { severity: 'high', created_count: created, updated_count: updated, error_count: errors.length } })

  return { created, updated, errors }
}
