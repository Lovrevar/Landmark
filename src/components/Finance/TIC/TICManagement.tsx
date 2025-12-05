import React, { useState, useEffect } from 'react'
import { FileDown, FileSpreadsheet, Save, AlertCircle } from 'lucide-react'
import { exportToExcel, exportToPDF } from './TICExport'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'

interface LineItem {
  name: string
  vlastita: number
  kreditna: number
}

interface Project {
  id: string
  name: string
}

interface TICData {
  id?: string
  project_id: string
  investor_name: string
  document_date: string
  line_items: LineItem[]
}

const defaultLineItems: LineItem[] = [
  { name: 'Priprema projekta', vlastita: 0, kreditna: 0 },
  { name: 'Vrijednost zemljišta', vlastita: 3000000, kreditna: 0 },
  { name: 'Porez na promet nekretnina', vlastita: 0, kreditna: 0 },
  { name: 'Projektna dokumentacija, geodetske usluge', vlastita: 268884, kreditna: 0 },
  { name: 'Komunalni i vodni doprinos', vlastita: 309337, kreditna: 0 },
  { name: 'Priključci', vlastita: 219790, kreditna: 0 },
  { name: 'Unutarnje uređenje', vlastita: 0, kreditna: 0 },
  { name: 'Građenje', vlastita: 750000, kreditna: 6935638 },
  { name: 'Opremanje (namještaj, bijela tehnika)', vlastita: 0, kreditna: 812401 },
  { name: 'Stručni nadzor', vlastita: 50789, kreditna: 0 },
  { name: 'Konzalting', vlastita: 59752, kreditna: 0 },
  { name: 'Posredovanje, marketing, osiguranje', vlastita: 80000, kreditna: 0 },
  { name: 'Financijski nadzor', vlastita: 0, kreditna: 26500 },
  { name: 'Financiranje', vlastita: 0, kreditna: 450000 },
  { name: 'Uknjižba, etažiranje, uporabna dozvola', vlastita: 8500, kreditna: 0 },
  { name: 'Nepredviđeni troškovi', vlastita: 0, kreditna: 424902 },
]

const TICManagement: React.FC = () => {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [ticId, setTicId] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>(defaultLineItems)
  const [investorName, setInvestorName] = useState('RAVNICE CITY D.O.O.')
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProjectId) {
      loadTICForProject(selectedProjectId)
    }
  }, [selectedProjectId])

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')

      if (error) throw error
      setProjects(data || [])

      if (data && data.length > 0) {
        const funtanaProject = data.find(p => p.name.toLowerCase().includes('funtana'))
        setSelectedProjectId(funtanaProject?.id || data[0].id)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
      showMessage('error', 'Greška pri učitavanju projekata')
    }
  }

  const loadTICForProject = async (projectId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tic_cost_structures')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setTicId(data.id)
        setInvestorName(data.investor_name)
        setDocumentDate(data.document_date)
        setLineItems(data.line_items as LineItem[])
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
  }

  const saveTIC = async () => {
    if (!selectedProjectId) {
      showMessage('error', 'Morate odabrati projekt')
      return
    }

    setSaving(true)
    try {
      const ticData = {
        project_id: selectedProjectId,
        investor_name: investorName,
        document_date: documentDate,
        line_items: lineItems,
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      }

      if (ticId) {
        const { error } = await supabase
          .from('tic_cost_structures')
          .update(ticData)
          .eq('id', ticId)

        if (error) throw error
        showMessage('success', 'TIC uspješno ažuriran')
      } else {
        const { data, error } = await supabase
          .from('tic_cost_structures')
          .insert([ticData])
          .select()
          .single()

        if (error) throw error
        setTicId(data.id)
        showMessage('success', 'TIC uspješno spremljen')
      }
    } catch (error) {
      console.error('Error saving TIC:', error)
      showMessage('error', 'Greška pri spremanju TIC podataka')
    } finally {
      setSaving(false)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }

  const formatPercentage = (num: number): string => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const calculateRowTotal = (vlastita: number, kreditna: number): number => {
    return vlastita + kreditna
  }

  const calculateRowPercentages = (value: number, total: number): number => {
    if (total === 0) return 0
    return (value / total) * 100
  }

  const calculateTotals = () => {
    const totals = lineItems.reduce(
      (acc, item) => ({
        vlastita: acc.vlastita + item.vlastita,
        kreditna: acc.kreditna + item.kreditna,
      }),
      { vlastita: 0, kreditna: 0 }
    )
    return totals
  }

  const totals = calculateTotals()
  const grandTotal = totals.vlastita + totals.kreditna

  const handleValueChange = (index: number, field: 'vlastita' | 'kreditna', value: string) => {
    const numValue = parseFloat(value) || 0
    const newItems = [...lineItems]
    newItems[index] = { ...newItems[index], [field]: numValue }
    setLineItems(newItems)
  }

  const handleExportExcel = () => {
    const selectedProject = projects.find(p => p.id === selectedProjectId)
    exportToExcel(lineItems, investorName, documentDate, totals, grandTotal, selectedProject?.name)
  }

  const handleExportPDF = () => {
    const selectedProject = projects.find(p => p.id === selectedProjectId)
    exportToPDF(lineItems, investorName, documentDate, totals, grandTotal, selectedProject?.name)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">TIC - Struktura Troškova Investicije</h2>
          <p className="text-gray-600 mt-1">Kalkulator troškova investicije (bez PDV-a)</p>

          <div className="mt-4 max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">Odaberi projekt:</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            >
              <option value="">-- Odaberi projekt --</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={saveTIC}
            disabled={!selectedProjectId || saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Spremam...' : 'Spremi'}
          </button>
          <button
            onClick={handleExportExcel}
            disabled={!selectedProjectId}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!selectedProjectId}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          <AlertCircle className="w-5 h-5" />
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavam TIC podatke...</p>
        </div>
      ) : !selectedProjectId ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto" />
          <p className="mt-4 text-gray-600">Odaberite projekt za pregled TIC strukture troškova</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-center text-gray-900 mb-6 uppercase">
            Struktura Troškova Investicije (bez PDV-a)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-900">
                    NAMJENA
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900" colSpan={2}>
                    VLASTITA SREDSTVA
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900" colSpan={2}>
                    KREDITNA SREDSTVA
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">
                    UKUPNA INVESTICIJA
                  </th>
                </tr>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2"></th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                    EUR
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                    (%)
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                    EUR
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                    (%)
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                    EUR
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => {
                  const rowTotal = calculateRowTotal(item.vlastita, item.kreditna)
                  const vlastitaPercent = calculateRowPercentages(item.vlastita, grandTotal)
                  const kreditnaPercent = calculateRowPercentages(item.kreditna, grandTotal)

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 text-gray-900">{item.name}</td>
                      <td className="border border-gray-300 px-2 py-2">
                        <input
                          type="number"
                          value={item.vlastita}
                          onChange={(e) => handleValueChange(index, 'vlastita', e.target.value)}
                          className="w-full px-2 py-1 text-right border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          step="0.01"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-gray-700">
                        {formatPercentage(vlastitaPercent)}%
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <input
                          type="number"
                          value={item.kreditna}
                          onChange={(e) => handleValueChange(index, 'kreditna', e.target.value)}
                          className="w-full px-2 py-1 text-right border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          step="0.01"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-gray-700">
                        {formatPercentage(kreditnaPercent)}%
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-900">
                        {formatNumber(rowTotal)}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-blue-50 font-bold">
                  <td className="border border-gray-300 px-4 py-3 text-gray-900 uppercase">UKUPNO:</td>
                  <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                    {formatNumber(totals.vlastita)}
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                    {formatPercentage(calculateRowPercentages(totals.vlastita, grandTotal))}%
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                    {formatNumber(totals.kreditna)}
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                    {formatPercentage(calculateRowPercentages(totals.kreditna, grandTotal))}%
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                    {formatNumber(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 space-y-4 max-w-xl">
            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 whitespace-nowrap">INVESTITOR:</label>
              <input
                type="text"
                value={investorName}
                onChange={(e) => setInvestorName(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 whitespace-nowrap">Za investitora:</label>
              <div className="flex-1 border-b-2 border-gray-300 pb-2">
                <span className="text-gray-400 text-sm">Potpis</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 whitespace-nowrap">Datum:</label>
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TICManagement
