import { useState, useCallback } from 'react'
import { ContractType } from '../types'
import { fetchActiveContractTypes } from '../services/contractTypesService'

export const useContractTypes = () => {
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchActiveContractTypes()
      setContractTypes(data)
    } catch (error) {
      console.error('Error loading contract types:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  return { contractTypes, loading, load }
}
