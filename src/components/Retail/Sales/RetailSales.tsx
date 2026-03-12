import React, { useState } from 'react'
import { ShoppingCart, Plus, Edit, Trash2, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { LoadingSpinner, PageHeader, StatGrid, SearchInput, Button, Modal, FormField, Input, Select, Textarea, Badge, EmptyState, StatCard, Table } from '../../ui'
import { useRetailSalesManager } from './hooks/useRetailSalesManager'
import type { SaleWithRelations, RetailSalePayload } from './services/retailSalesService'

const emptyForm = () => ({
  land_plot_id: '',
  customer_id: '',
  sale_area_m2: '',
  sale_price_per_m2: '',
  payment_deadline: '',
  contract_number: '',
  notes: ''
})

type FormState = ReturnType<typeof emptyForm>

const RetailSales: React.FC = () => {
  const {
    loading, landPlots, customers, filteredSales, totalStats,
    searchTerm, setSearchTerm, statusFilter, setStatusFilter,
    handleSave, handleDelete, handleAddPayment
  } = useRetailSalesManager()

  const [showFormModal, setShowFormModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleWithRelations | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormState>(emptyForm())
  const [paymentAmount, setPaymentAmount] = useState('')

  const openFormModal = (sale?: SaleWithRelations) => {
    if (sale) {
      setEditingId(sale.id)
      setFormData({
        land_plot_id: sale.land_plot_id,
        customer_id: sale.customer_id,
        sale_area_m2: sale.sale_area_m2.toString(),
        sale_price_per_m2: sale.sale_price_per_m2.toString(),
        payment_deadline: sale.payment_deadline,
        contract_number: sale.contract_number || '',
        notes: sale.notes || ''
      })
    } else {
      setEditingId(null)
      setFormData(emptyForm())
    }
    document.body.style.overflow = 'hidden'
    setShowFormModal(true)
  }

  const closeFormModal = () => {
    document.body.style.overflow = 'unset'
    setShowFormModal(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: RetailSalePayload = {
        land_plot_id: formData.land_plot_id,
        customer_id: formData.customer_id,
        sale_area_m2: parseFloat(formData.sale_area_m2),
        sale_price_per_m2: parseFloat(formData.sale_price_per_m2),
        payment_deadline: formData.payment_deadline,
        contract_number: formData.contract_number || null,
        notes: formData.notes || null
      }
      await handleSave(payload, editingId ?? undefined)
      closeFormModal()
    } catch (error) {
      console.error('Error saving sale:', error)
      alert('Greška pri spremanju prodaje')
    }
  }

  const openPaymentModal = (sale: SaleWithRelations) => {
    setSelectedSale(sale)
    setPaymentAmount('')
    document.body.style.overflow = 'hidden'
    setShowPaymentModal(true)
  }

  const closePaymentModal = () => {
    document.body.style.overflow = 'unset'
    setShowPaymentModal(false)
    setSelectedSale(null)
    setPaymentAmount('')
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSale) return
    try {
      await handleAddPayment(selectedSale, parseFloat(paymentAmount))
      closePaymentModal()
    } catch (error) {
      console.error('Error adding payment:', error)
      alert('Greška pri dodavanju plaćanja')
    }
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [key]: e.target.value }))

  if (loading) return <LoadingSpinner message="Učitavanje..." />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prodaje"
        description="Upravljanje prodajama i rokovima plaćanja"
        actions={<Button icon={Plus} onClick={() => openFormModal()}>Nova prodaja</Button>}
      />

      <StatGrid columns={4}>
        <StatCard label="Ukupno prodaja" value={totalStats.total_sales} icon={ShoppingCart} color="blue" />
        <StatCard label="Ukupni prihod" value={'€' + totalStats.total_revenue.toLocaleString('hr-HR')} icon={DollarSign} color="green" />
        <StatCard label="Plaćeno" value={'€' + totalStats.total_paid.toLocaleString('hr-HR')} icon={DollarSign} color="green" />
        <StatCard label="Za naplatu" value={'€' + totalStats.total_remaining.toLocaleString('hr-HR')} icon={DollarSign} />
      </StatGrid>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            placeholder="Pretraži po kupcu, čestici ili ugovoru..."
            className="flex-1"
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Svi statusi</option>
            <option value="pending">Pending</option>
            <option value="partial">Djelomično</option>
            <option value="paid">Plaćeno</option>
            <option value="overdue">Kašnjenje</option>
          </Select>
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={searchTerm || statusFilter !== 'all' ? 'Nema rezultata pretrage' : 'Nema prodaja'}
          description={searchTerm || statusFilter !== 'all' ? 'Pokušajte s drugim kriterijima' : 'Dodajte prvu prodaju klikom na gumb iznad'}
        />
      ) : (
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>Kupac</Table.Th>
              <Table.Th>Čestica</Table.Th>
              <Table.Th>Površina</Table.Th>
              <Table.Th>Ukupno</Table.Th>
              <Table.Th>Plaćeno</Table.Th>
              <Table.Th>Rok</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="text-right">Akcije</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredSales.map((sale) => (
              <Table.Tr key={sale.id}>
                <Table.Td><div className="text-sm font-medium text-gray-900">{sale.customer?.name || 'N/A'}</div></Table.Td>
                <Table.Td><div className="text-sm text-gray-900">{sale.land_plot?.plot_number || 'N/A'}</div></Table.Td>
                <Table.Td>
                  <div className="text-sm text-gray-900">{sale.sale_area_m2.toLocaleString()} m²</div>
                  <div className="text-xs text-gray-500">€{sale.sale_price_per_m2}/m²</div>
                </Table.Td>
                <Table.Td><div className="text-sm font-semibold text-gray-900">€{sale.total_sale_price.toLocaleString('hr-HR')}</div></Table.Td>
                <Table.Td>
                  <div className="text-sm text-green-600">€{sale.paid_amount.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Preostalo: €{sale.remaining_amount.toLocaleString('hr-HR')}</div>
                </Table.Td>
                <Table.Td><div className="text-sm text-gray-900">{format(new Date(sale.payment_deadline), 'dd.MM.yyyy')}</div></Table.Td>
                <Table.Td>
                  <Badge variant={
                    sale.payment_status === 'paid' ? 'green'
                      : sale.payment_status === 'partial' ? 'yellow'
                      : sale.payment_status === 'overdue' ? 'red'
                      : 'gray'
                  }>
                    {sale.payment_status === 'paid' ? 'Plaćeno' :
                     sale.payment_status === 'partial' ? 'Djelomično' :
                     sale.payment_status === 'overdue' ? 'Kašnjenje' : 'Pending'}
                  </Badge>
                </Table.Td>
                <Table.Td className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    {sale.payment_status !== 'paid' && (
                      <Button icon={DollarSign} variant="ghost" size="icon-sm" onClick={() => openPaymentModal(sale)} title="Dodaj plaćanje" />
                    )}
                    <Button icon={Edit} variant="ghost" size="icon-sm" onClick={() => openFormModal(sale)} title="Uredi" />
                    <Button icon={Trash2} variant="outline-danger" size="icon-sm" onClick={() => handleDelete(sale.id)} title="Obriši" />
                  </div>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
      )}

      <Modal show={showFormModal} onClose={closeFormModal}>
        <Modal.Header title={editingId ? 'Uredi prodaju' : 'Nova prodaja'} onClose={closeFormModal} />
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <FormField label="Čestica" required>
              <Select required value={formData.land_plot_id} onChange={set('land_plot_id')}>
                <option value="">Odaberite česticu</option>
                {landPlots.map((plot) => (
                  <option key={plot.id} value={plot.id}>{plot.plot_number} - {plot.owner_first_name} {plot.owner_last_name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Kupac" required>
              <Select required value={formData.customer_id} onChange={set('customer_id')}>
                <option value="">Odaberite kupca</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Površina (m²)" required>
                <Input type="number" step="0.01" required value={formData.sale_area_m2} onChange={set('sale_area_m2')} />
              </FormField>
              <FormField label="Cijena po m² (€)" required>
                <Input type="number" step="0.01" required value={formData.sale_price_per_m2} onChange={set('sale_price_per_m2')} />
              </FormField>
            </div>

            <FormField label="Rok plaćanja" required>
              <Input type="date" required value={formData.payment_deadline} onChange={set('payment_deadline')} />
            </FormField>

            <FormField label="Broj ugovora">
              <Input type="text" value={formData.contract_number} onChange={set('contract_number')} />
            </FormField>

            <FormField label="Napomene">
              <Textarea rows={3} value={formData.notes} onChange={set('notes')} />
            </FormField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={closeFormModal}>Odustani</Button>
            <Button type="submit">{editingId ? 'Spremi' : 'Dodaj'}</Button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal show={showPaymentModal && !!selectedSale} onClose={closePaymentModal} size="sm">
        <Modal.Header title="Dodaj plaćanje" onClose={closePaymentModal} />
        <form onSubmit={handlePaymentSubmit}>
          <Modal.Body>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Kupac</p>
              <p className="text-lg font-semibold">{selectedSale?.customer?.name}</p>
            </div>
            <div className="mb-4 bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Ukupno:</span>
                <span className="font-semibold">€{selectedSale?.total_sale_price.toLocaleString('hr-HR')}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Plaćeno:</span>
                <span className="font-semibold text-green-600">€{selectedSale?.paid_amount.toLocaleString('hr-HR')}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm text-gray-600">Preostalo:</span>
                <span className="font-bold text-orange-600">€{selectedSale?.remaining_amount.toLocaleString('hr-HR')}</span>
              </div>
            </div>
            <FormField label="Iznos plaćanja (€)" required>
              <Input
                type="number"
                step="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                max={selectedSale?.remaining_amount}
              />
            </FormField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={closePaymentModal}>Odustani</Button>
            <Button variant="success" type="submit">Dodaj plaćanje</Button>
          </Modal.Footer>
        </form>
      </Modal>
    </div>
  )
}

export default RetailSales
