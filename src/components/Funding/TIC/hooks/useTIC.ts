import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import { LineItem, calculateTotals } from '../utils/ticFormatters'
import {
  fetchTICProjects,
  fetchTICForProject,
  updateTIC,
  createTIC,
  type TICProject,
} from '../services/ticService'

const defaultLineItems: LineItem[] = [
  { name: 'Priprema projekta', vlastita: 0, kreditna: 0 },
  { name: 'Vrijednost zemljišta', vlastita: 0, kreditna: 0 },
  { name: 'Porez na promet nekretnina', vlastita: 0, kreditna: 0 },
  { name: 'Projektna dokumentacija, geodetske usluge', vlastita: 0, kreditna: 0 },
  { name: 'Komunalni i vodni doprinos', vlastita: 0, kreditna: 0 },
  { name: 'Priključci', vlastita: 0, kreditna: 0 },
  { name: 'Unutarnje uređenje', vlastita: 0, kreditna: 0 },
  { name: 'Građenje', vlastita: 0, kreditna: 0 },
  { name: 'Opremanje (namještaj, bijela tehnika)', vlastita: 0, kreditna: 0 },
  { name: 'Stručni nadzor', vlastita: 0, kreditna: 0 },
  { name: 'Konzalting', vlastita: 0, kreditna: 0 },
  { name: 'Posredovanje, marketing, osiguranje', vlastita: 0, kreditna: 0 },
  { name: 'Financijski nadzor', vlastita: 0, kreditna: 0 },
  { name: 'Financiranje', vlastita: 0, kreditna: 0 },
  { name: 'Uknjižba, etažiranje, uporabna dozvola', vlastita: 0, kreditna: 0 },
  { name: 'Nepredviđeni troškovi', vlastita: 0, kreditna: 0 },
]

export function useTIC() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<TICProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [ticId, setTicId] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>(defaultLineItems)
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
        setLineItems(data.line_items)
      } else {
        setTicId(null)
        setInvestorName('RAVNICE CITY D.O.O.')
        setDocumentDate(new Date().toISOString().split('T')[0])
        setLineItems(defaultLineItems)
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
  }, [selectedProjectId, investorName, documentDate, lineItems, user?.id, ticId, showMessage])

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

  return {
    projects,
    lineItems,
    setLineItems,
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
    saveTIC
  }
}
