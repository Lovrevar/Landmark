import { useState, useCallback } from 'react'
import { ContractType } from '../types'
import { fetchActiveContractTypes } from '../services/contractTypesService'

export const useContractTypes = () => {
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchActiveContractTypes()
      setContractTypes(data)
    } catch (err) {
      console.error('Error loading contract types:', err)
      // A silently empty category dropdown reads as "this project has no categories", and the
      // form then refuses to save for a reason the user cannot see.
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  return { contractTypes, loading, error, load, refetch: load }
}
