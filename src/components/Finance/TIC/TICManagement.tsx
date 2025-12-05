import React, { useState } from 'react'
import { FileDown, FileSpreadsheet } from 'lucide-react'
import { exportToExcel, exportToPDF } from './TICExport'

interface LineItem {
  name: string
  vlastita: number
  kreditna: number
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
  const [lineItems, setLineItems] = useState<LineItem[]>(defaultLineItems)
  const [investorName, setInvestorName] = useState('RAVNICE CITY D.O.O.')
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0])

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('hr-HR', {
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
    totals.vlastita + totals.kreditna
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
    exportToExcel(lineItems, investorName, documentDate, totals, grandTotal)
  }

  const handleExportPDF = () => {
    exportToPDF(lineItems, investorName, documentDate, totals, grandTotal)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">TIC - Struktura Troškova Investicije</h2>
          <p className="text-gray-600 mt-1">Kalkulator troškova investicije (bez PDV-a)</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

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
                const vlastitaPercent = calculateRowPercentages(item.vlastita, rowTotal)
                const kreditnaPercent = calculateRowPercentages(item.kreditna, rowTotal)

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
                      {formatNumber(vlastitaPercent)}%
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
                      {formatNumber(kreditnaPercent)}%
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
                  {formatNumber(calculateRowPercentages(totals.vlastita, grandTotal))}%
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                  {formatNumber(totals.kreditna)}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                  {formatNumber(calculateRowPercentages(totals.kreditna, grandTotal))}%
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
    </div>
  )
}

export default TICManagement
