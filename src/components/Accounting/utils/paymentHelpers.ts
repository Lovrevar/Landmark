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
    case 'WIRE': return 'bg-blue-100 text-blue-800'
    case 'CASH': return 'bg-green-100 text-green-800'
    case 'CHECK': return 'bg-yellow-100 text-yellow-800'
    case 'CARD': return 'bg-purple-100 text-purple-800'
    default: return 'bg-gray-100 text-gray-800'
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
