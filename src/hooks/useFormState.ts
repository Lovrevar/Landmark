import { useState, useCallback } from 'react'

export function useFormState<T extends Record<string, any>>(initialState: T) {
  const [formData, setFormData] = useState<T>(initialState)

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateFields = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }, [])

  const resetForm = useCallback(() => {
    setFormData(initialState)
  }, [initialState])

  const setForm = useCallback((newData: T) => {
    setFormData(newData)
  }, [])

  return {
    formData,
    updateField,
    updateFields,
    resetForm,
    setForm
  }
}
