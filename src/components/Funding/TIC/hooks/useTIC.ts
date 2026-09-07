import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import { logActivity } from '../../../../lib/activityLog'
import {
  LineItem,
  ConstructionItem,
  ConstructionSection,
  calculateTotals,
  calculateConstructionTotals,
  toRomanNumeral,
  toSectionCode,
} from '../utils/ticFormatters'
import { defaultLineItems, defaultConstructionSections } from '../constants'
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

export function useTIC() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<TICProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [ticId, setTicId] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>(defaultLineItems)
  const [constructionSections, setConstructionSections] = useState<ConstructionSection[]>(defaultConstructionSections)
  const [investorName, setInvestorName] = useState('RAVNICE CITY D.O.O.')
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
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
      if (data) {
        setTicId(data.id)
        setInvestorName(data.investor_name)
        setDocumentDate(data.document_date)
        setLineItems(data.line_items.length > 0 ? data.line_items : defaultLineItems)
        // Records saved before the GRAĐENJE tab existed fall back to the defaults.
        setConstructionSections(
          data.construction_sections.length > 0 ? data.construction_sections : defaultConstructionSections
        )
      } else {
        setTicId(null)
        setInvestorName('RAVNICE CITY D.O.O.')
        setDocumentDate(new Date().toISOString().split('T')[0])
        setLineItems(defaultLineItems)
        setConstructionSections(defaultConstructionSections)
      }
    } catch (error) {
      console.error('Error loading TIC:', error)
      showMessage('error', 'Greška pri učitavanju TIC podataka')
    } finally {
      setLoading(false)
    }
  }, [showMessage])

  const saveTIC = useCallback(async () => {
    if (!selectedProjectId) {
      showMessage('error', 'Morate odabrati projekt')
      return
    }

    setSaving(true)
    try {
      const payload = {
        project_id: selectedProjectId,
        investor_name: investorName,
        document_date: documentDate,
        line_items: lineItems,
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
    } catch (error) {
      console.error('Error saving TIC:', error)
      showMessage('error', 'Greška pri spremanju TIC podataka')
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
      setLineItems(parsed.investment.lineItems)
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
  }, [ticId, selectedProjectId])

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

  return {
    projects,
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
    saveTIC,
    addLineItem,
    updateLineItem,
    removeLineItem,
    moveLineItem,
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
