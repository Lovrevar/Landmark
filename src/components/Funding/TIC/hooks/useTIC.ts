import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import { logActivity } from '../../../../lib/activityLog'
import {
  LineItem,
  LineItemPhaseAmount,
  ConstructionItem,
  ConstructionSection,
  calculateTotals,
  calculateConstructionTotals,
  toRomanNumeral,
  toSectionCode,
} from '../utils/ticFormatters'
import { defaultLineItems, defaultConstructionSections } from '../constants'
import { applyDefaultClassifications } from '../utils/ticClassificationMap'
import { totalsByClassification, ticPhaseCount, normalizePhaseNumbers } from '../utils/ticBudget'
// cost_classifications is a global lookup, not a Supervision-owned one — the service simply
// lives next to its first consumer. Imported directly rather than duplicated here.
import { fetchCostClassifications } from '../../../Supervision/SiteManagement/services/costClassificationService'
import type { CostClassification } from '../../../../lib/supabase'
import {
  fetchTICProjects,
  fetchTICForProject,
  updateTIC,
  createTIC,
  type TICProject,
} from '../services/ticService'
import type { ParsedWorkbook } from '../services/ticImport'

const moveInArray = <T,>(items: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= items.length || from === to) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * What "unchanged since it was loaded or last saved" means for the TIC screen.
 *
 * Compared as a serialized string rather than by reference: every row edit replaces the objects,
 * so reference equality would call an undone edit a change. The baseline is always taken from
 * the very values handed to `setState`, so key order matches and a reload cannot look dirty.
 */
const snapshot = (
  lineItems: LineItem[],
  constructionSections: ConstructionSection[],
  investorName: string,
  documentDate: string
): string => JSON.stringify({ lineItems, constructionSections, investorName, documentDate })

export function useTIC() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<TICProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [ticId, setTicId] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>(defaultLineItems)
  const [constructionSections, setConstructionSections] = useState<ConstructionSection[]>(defaultConstructionSections)
  const [investorName, setInvestorName] = useState('RAVNICE CITY D.O.O.')
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0])
  const [classifications, setClassifications] = useState<CostClassification[]>([])
  /**
   * How many phase columns the table shows.
   *
   * At least as many as the rows use, but the user can add one more to have somewhere to type —
   * a column no row has an amount in exists only on screen, and the database never hears about
   * it. Reset to what the data says on every load and save.
   */
  const [phaseColumns, setPhaseColumns] = useState(0)
  const [baseline, setBaseline] = useState(() =>
    snapshot(defaultLineItems, defaultConstructionSections, 'RAVNICE CITY D.O.O.', new Date().toISOString().split('T')[0])
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }, [])

  const loadClassifications = useCallback(async () => {
    try {
      setClassifications(await fetchCostClassifications())
    } catch (error) {
      // Not fatal: without the list the classification column falls back to "unmapped", which is
      // visible and recoverable. Blocking the whole TIC screen over it would not be.
      console.error('Error loading cost classifications:', error)
    }
  }, [])

  const loadProjects = useCallback(async () => {
    try {
      const data = await fetchTICProjects()
      setProjects(data)

      if (data.length > 0) {
        const funtanaProject = data.find((p) => p.name.toLowerCase().includes('funtana'))
        setSelectedProjectId(funtanaProject?.id || data[0].id)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
      showMessage('error', 'Greška pri učitavanju projekata')
    }
  }, [showMessage])

  const loadTICForProject = useCallback(async (projectId: string) => {
    setLoading(true)
    try {
      const data = await fetchTICForProject(projectId)

      const items = applyDefaultClassifications(
        data && data.line_items.length > 0 ? data.line_items : defaultLineItems,
        classifications
      )
      // Records saved before the GRAĐENJE tab existed fall back to the defaults.
      const sections =
        data && data.construction_sections.length > 0 ? data.construction_sections : defaultConstructionSections
      const investor = data?.investor_name ?? 'RAVNICE CITY D.O.O.'
      const date = data?.document_date ?? new Date().toISOString().split('T')[0]

      setTicId(data?.id ?? null)
      setInvestorName(investor)
      setDocumentDate(date)
      setLineItems(items)
      setConstructionSections(sections)
      setPhaseColumns(ticPhaseCount(items))
      // Everything just loaded is, by definition, saved.
      setBaseline(snapshot(items, sections, investor, date))
    } catch (error) {
      console.error('Error loading TIC:', error)
      showMessage('error', 'Greška pri učitavanju TIC podataka')
    } finally {
      setLoading(false)
    }
  }, [showMessage, classifications])

  /**
   * Save, reporting whether it worked.
   *
   * The boolean is not for the Save button — it is for the unsaved-changes dialog's "save and
   * leave", which must not navigate away from work that failed to save. Errors are still reported
   * here, as a message on the screen; the caller only needs to know whether to proceed.
   */
  const saveTIC = useCallback(async (): Promise<boolean> => {
    if (!selectedProjectId) {
      showMessage('error', 'Morate odabrati projekt')
      return false
    }

    setSaving(true)
    try {
      // A gap in the phase ordinals makes sync_project_from_tic delete the phase it has just
      // created, so the numbering is closed up before it ever reaches the database. Written back
      // to state too, so the screen shows what was actually stored.
      const items = normalizePhaseNumbers(lineItems)

      const payload = {
        project_id: selectedProjectId,
        investor_name: investorName,
        document_date: documentDate,
        line_items: items,
        construction_sections: constructionSections,
        created_by: user?.id,
      }

      if (ticId) {
        await updateTIC(ticId, payload, selectedProjectId)
        showMessage('success', 'TIC uspješno ažuriran')
      } else {
        const newId = await createTIC(payload)
        setTicId(newId)
        showMessage('success', 'TIC uspješno spremljen')
      }

      setLineItems(items)
      setPhaseColumns(ticPhaseCount(items))
      setBaseline(snapshot(items, constructionSections, investorName, documentDate))
      return true
    } catch (error) {
      console.error('Error saving TIC:', error)
      showMessage('error', 'Greška pri spremanju TIC podataka')
      return false
    } finally {
      setSaving(false)
    }
  }, [selectedProjectId, investorName, documentDate, lineItems, constructionSections, user?.id, ticId, showMessage])

  // --- INVESTICIJA row editing -------------------------------------------------

  const updateLineItem = useCallback((index: number, patch: Partial<LineItem>) => {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }, [])

  const addLineItem = useCallback(() => {
    setLineItems((items) => [...items, { name: '', vlastita: 0, kreditna: 0 }])
  }, [])

  const removeLineItem = useCallback((index: number) => {
    setLineItems((items) => items.filter((_, i) => i !== index))
  }, [])

  const moveLineItem = useCallback((index: number, direction: -1 | 1) => {
    setLineItems((items) => moveInArray(items, index, index + direction))
  }, [])

  // --- INVESTICIJA phase split -------------------------------------------------

  /**
   * Replace one row's per-phase split, or clear it.
   *
   * `undefined` is not an empty split: it means the cost is incurred once for the whole project
   * and belongs to no phase. The `phases` key is dropped entirely rather than set to `[]`, so a
   * saved row reads the same way the importer writes one.
   */
  const setLineItemPhases = useCallback((index: number, phases: LineItemPhaseAmount[] | undefined) => {
    setLineItems((items) =>
      items.map((item, i) => {
        if (i !== index) return item
        if (!phases || phases.length === 0) {
          const { phases: _dropped, ...rest } = item
          return rest
        }
        return { ...item, phases }
      })
    )
  }, [])

  /** Add an empty phase column at the end. Nothing is written to any row until it is filled in. */
  const addPhase = useCallback(() => {
    setPhaseColumns((count) => Math.max(count, ticPhaseCount(lineItems)) + 1)
  }, [lineItems])

  /**
   * Drop a phase from every row and close the gap it leaves.
   *
   * Renumbering is not cosmetic: `sync_project_from_tic` counts the phases a TIC names and
   * deletes every project phase numbered above that count, so leaving a hole at 2 would make it
   * delete the phase that had been 3.
   */
  const removePhase = useCallback((phaseNumber: number) => {
    setLineItems((items) =>
      items.map((item) => {
        if (!item.phases) return item
        const phases = item.phases
          .filter((p) => p.phase_number !== phaseNumber)
          .map((p) => (p.phase_number > phaseNumber ? { ...p, phase_number: p.phase_number - 1 } : p))
        // A row left with no phase at all is project-level again, not a row with an empty split.
        if (phases.length === 0) {
          const { phases: _dropped, ...rest } = item
          return rest
        }
        return { ...item, phases }
      })
    )
    setPhaseColumns((count) => Math.max(0, count - 1))
  }, [])

  // --- GRAĐENJE section / item editing -----------------------------------------

  const updateSection = useCallback((sectionIndex: number, patch: Partial<Omit<ConstructionSection, 'items'>>) => {
    setConstructionSections((sections) =>
      sections.map((section, i) => (i === sectionIndex ? { ...section, ...patch } : section))
    )
  }, [])

  const addSection = useCallback(() => {
    setConstructionSections((sections) => [...sections, { code: toSectionCode(sections.length), name: '', items: [] }])
  }, [])

  const removeSection = useCallback((sectionIndex: number) => {
    setConstructionSections((sections) => sections.filter((_, i) => i !== sectionIndex))
  }, [])

  const moveSection = useCallback((sectionIndex: number, direction: -1 | 1) => {
    setConstructionSections((sections) => moveInArray(sections, sectionIndex, sectionIndex + direction))
  }, [])

  const updateConstructionItem = useCallback(
    (sectionIndex: number, itemIndex: number, patch: Partial<ConstructionItem>) => {
      setConstructionSections((sections) =>
        sections.map((section, i) =>
          i === sectionIndex
            ? { ...section, items: section.items.map((item, j) => (j === itemIndex ? { ...item, ...patch } : item)) }
            : section
        )
      )
    },
    []
  )

  const addConstructionItem = useCallback((sectionIndex: number) => {
    setConstructionSections((sections) =>
      sections.map((section, i) =>
        i === sectionIndex
          ? {
              ...section,
              items: [
                ...section.items,
                { numeral: toRomanNumeral(section.items.length + 1), name: '', vlastita: 0, kreditna: 0 },
              ],
            }
          : section
      )
    )
  }, [])

  const removeConstructionItem = useCallback((sectionIndex: number, itemIndex: number) => {
    setConstructionSections((sections) =>
      sections.map((section, i) =>
        i === sectionIndex ? { ...section, items: section.items.filter((_, j) => j !== itemIndex) } : section
      )
    )
  }, [])

  const moveConstructionItem = useCallback((sectionIndex: number, itemIndex: number, direction: -1 | 1) => {
    setConstructionSections((sections) =>
      sections.map((section, i) =>
        i === sectionIndex ? { ...section, items: moveInArray(section.items, itemIndex, itemIndex + direction) } : section
      )
    )
  }, [])

  // --- Excel import ------------------------------------------------------------

  /**
   * Replaces the on-screen tables with the parsed workbook. Nothing is written to the
   * database until the user presses Save, so an unwanted import can be undone by
   * switching projects.
   */
  const applyImport = useCallback((parsed: ParsedWorkbook, fileName: string) => {
    const sheets: string[] = []

    if (parsed.investment) {
      // Parsed rows carry no classification. Stamping the defaults here is what stops an import
      // from emptying the mapping — and with it the per-classification totals and any phase
      // budget populated from them.
      setLineItems(applyDefaultClassifications(parsed.investment.lineItems, classifications))
      sheets.push(parsed.investment.sheetName)
    }
    if (parsed.construction) {
      setConstructionSections(parsed.construction.sections)
      sheets.push(parsed.construction.sheetName)
    }
    if (parsed.investorName) setInvestorName(parsed.investorName)
    if (parsed.documentDate) setDocumentDate(parsed.documentDate)

    logActivity({
      action: 'tic.import_excel',
      entity: 'tic_cost_structures',
      entityId: ticId,
      projectId: selectedProjectId || null,
      severity: 'high',
      metadata: {
        file_name: fileName,
        sheets,
        count:
          (parsed.investment?.lineItems.length ?? 0) +
          (parsed.construction?.sections.reduce((sum, s) => sum + s.items.length, 0) ?? 0),
      },
    })
  }, [ticId, selectedProjectId, classifications])

  useEffect(() => {
    loadClassifications()
  }, [loadClassifications])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    if (selectedProjectId) {
      loadTICForProject(selectedProjectId)
    }
  }, [selectedProjectId, loadTICForProject])

  const totals = calculateTotals(lineItems)
  const grandTotal = totals.vlastita + totals.kreditna

  const constructionTotals = calculateConstructionTotals(constructionSections)
  const constructionGrandTotal = constructionTotals.vlastita + constructionTotals.kreditna

  // What the phase budgets will be populated from. Derived, like every other TIC total.
  const classificationTotals = totalsByClassification(lineItems)
  // The phase columns to render: 1..n, contiguous. Derived from the highest ordinal any row uses
  // rather than the set of ordinals present, so a phase left empty in the middle keeps its column
  // instead of silently renumbering the ones after it. Empty for an unphased TIC.
  const phaseCount = Math.max(ticPhaseCount(lineItems), phaseColumns)
  const phaseNumbers = Array.from({ length: phaseCount }, (_, i) => i + 1)

  // Whether leaving now would lose work — what the unsaved-changes guard is armed from.
  const isDirty = baseline !== snapshot(lineItems, constructionSections, investorName, documentDate)

  return {
    projects,
    classifications,
    classificationTotals,
    phaseNumbers,
    lineItems,
    setLineItems,
    constructionSections,
    setConstructionSections,
    investorName,
    setInvestorName,
    documentDate,
    setDocumentDate,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    saving,
    message,
    totals,
    grandTotal,
    constructionTotals,
    constructionGrandTotal,
    isDirty,
    saveTIC,
    addLineItem,
    updateLineItem,
    removeLineItem,
    moveLineItem,
    setLineItemPhases,
    addPhase,
    removePhase,
    addSection,
    updateSection,
    removeSection,
    moveSection,
    addConstructionItem,
    updateConstructionItem,
    removeConstructionItem,
    moveConstructionItem,
    applyImport,
  }
}
