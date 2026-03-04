import { useMemo } from 'react'

export const useVATCalculation = (baseAmount: number, vatRate: number) => {
  return useMemo(() => {
    const vatAmount = Math.round(baseAmount * vatRate) / 100
    const totalAmount = baseAmount + vatAmount
    return { vatAmount, totalAmount }
  }, [baseAmount, vatRate])
}
