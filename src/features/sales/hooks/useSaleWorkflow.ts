import { useState } from 'react'
import { format } from 'date-fns'
import { SaleData, UnitType } from '../types'
import { Apartment, Garage, Repository } from '../../../lib/supabase'
import * as CustomersRepo from '../services/customers.repo'
import * as SalesRepo from '../services/sales.repo'
import * as UnitsRepo from '../services/units.repo'

const initialSaleData: SaleData = {
  customer_id: '',
  sale_price: 0,
  payment_method: 'bank_loan',
  down_payment: 0,
  monthly_payment: 0,
  sale_date: format(new Date(), 'yyyy-MM-dd'),
  contract_signed: false,
  notes: '',
  buyer_name: '',
  buyer_email: '',
  buyer_phone: '',
  buyer_address: ''
}

export function useSaleWorkflow(onSuccess: () => void) {
  const [unitForSale, setUnitForSale] = useState<{
    unit: Apartment | Garage | Repository
    type: UnitType
  } | null>(null)
  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('new')
  const [saleData, setSaleData] = useState<SaleData>(initialSaleData)
  const [showSaleForm, setShowSaleForm] = useState(false)

  const handleSellUnit = (unit: Apartment | Garage | Repository, unitType: UnitType) => {
    setUnitForSale({ unit, type: unitType })
    setSaleData(prev => ({
      ...prev,
      sale_price: unit.price
    }))
    setShowSaleForm(true)
  }

  const resetSaleForm = () => {
    setSaleData(initialSaleData)
    setCustomerMode('new')
    setUnitForSale(null)
    setShowSaleForm(false)
  }

  const completeSale = async () => {
    if (!unitForSale) return

    try {
      let customerId = saleData.customer_id

      if (customerMode === 'new') {
        if (!saleData.buyer_name.trim() || !saleData.buyer_email.trim()) {
          alert('Please fill in buyer name and email')
          return
        }

        const [firstName, ...lastNameParts] = saleData.buyer_name.trim().split(' ')
        const lastName = lastNameParts.join(' ') || firstName

        const { data: newCustomer, error: customerError } = await CustomersRepo.createCustomer({
          name: firstName,
          surname: lastName,
          email: saleData.buyer_email,
          phone: saleData.buyer_phone || '',
          address: saleData.buyer_address || '',
          status: 'buyer'
        })

        if (customerError) throw customerError
        customerId = newCustomer.id
      }

      const { error: saleError } = await SalesRepo.createSale({
        unitId: unitForSale.unit.id,
        unitType: unitForSale.type,
        customerId: customerId,
        salePrice: saleData.sale_price,
        paymentMethod: saleData.payment_method,
        downPayment: saleData.down_payment,
        monthlyPayment: saleData.monthly_payment,
        saleDate: saleData.sale_date,
        contractSigned: saleData.contract_signed,
        notes: saleData.notes
      })

      if (saleError) throw saleError

      if (customerMode === 'existing' && customerId) {
        const { error: customerUpdateError } = await CustomersRepo.updateCustomerStatus(
          customerId,
          'buyer'
        )
        if (customerUpdateError) {
          console.error('Error updating customer status:', customerUpdateError)
        }
      }

      const { error: unitError } = await UnitsRepo.updateUnitWithSale(
        unitForSale.unit.id,
        unitForSale.type,
        saleData.buyer_name
      )

      if (unitError) throw unitError

      alert('Sale completed successfully!')
      resetSaleForm()
      onSuccess()
    } catch (error) {
      console.error('Error completing sale:', error)
      alert('Error completing sale. Please try again.')
    }
  }

  return {
    unitForSale,
    customerMode,
    saleData,
    showSaleForm,
    setCustomerMode,
    setSaleData,
    handleSellUnit,
    resetSaleForm,
    completeSale
  }
}
