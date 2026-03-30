export const getPaymentMethodLabel = (method: string) => {
  switch (method) {
    case 'WIRE': return 'Virman'
    case 'CASH': return 'Gotovina'
    case 'CHECK': return 'Ček'
    case 'CARD': return 'Kartica'
    default: return method
  }
}

export const getPaymentMethodColor = (method: string) => {
  switch (method) {
    case 'WIRE': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
    case 'CASH': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    case 'CHECK': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
    case 'CARD': return 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
  }
}

export const columnLabels = {
  payment_date: 'Datum plaćanja',
  invoice_number: 'Broj računa',
  my_company: 'Moja Firma',
  invoice_type: 'Tip računa',
  company_supplier: 'Firma/Dobavljač',
  amount: 'Iznos',
  payment_method: 'Način plaćanja',
  reference_number: 'Referenca',
  description: 'Opis'
}
