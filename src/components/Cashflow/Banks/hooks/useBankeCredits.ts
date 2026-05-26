import { useState, useEffect } from 'react'
import {
  fetchBankeCreditsData,
  type BankeBank,
  type BankeCredit,
  type BankeCreditAllocation,
} from '../services/bankeCreditsService'

// Re-export shared types for any callers that imported them from here.
export type { BankeBank, BankeCredit, BankeCreditAllocation }

const useBankeCredits = () => {
  const [banks, setBanks] = useState<BankeBank[]>([])
  const [credits, setCredits] = useState<BankeCredit[]>([])
  const [allocations, setAllocations] = useState<Map<string, BankeCreditAllocation[]>>(new Map())
  const [disbursedAmounts, setDisbursedAmounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const data = await fetchBankeCreditsData()
      setBanks(data.banks)
      setCredits(data.credits)
      setAllocations(data.allocations)
      setDisbursedAmounts(data.disbursedAmounts)
    } catch (error) {
      console.error('Error fetching cashflow banks data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const creditsByBank = (bankId: string) =>
    credits.filter((c) => c.bank_id === bankId)

  return { banks, credits, allocations, disbursedAmounts, loading, creditsByBank, refetch: fetchAll }
}

export default useBankeCredits
