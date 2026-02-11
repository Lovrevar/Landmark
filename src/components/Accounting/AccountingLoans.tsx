import React from 'react'
import { TrendingUp, Plus, Trash2, X, Building2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import DateInput from '../Common/DateInput'
import { useLoans } from './hooks/useLoans'
import { PageHeader, LoadingSpinner, SearchInput, Button, Modal, FormField, Select, Input } from '../ui'

const AccountingLoans: React.FC = () => {
  const {
    companies,
    loading,
    searchTerm,
    setSearchTerm,
    showAddModal,
    setShowAddModal,
    formData,
    setFormData,
    handleAddLoan,
    handleDeleteLoan,
    resetForm,
    getFromCompanyAccounts,
    getToCompanyAccounts,
    filteredLoans
  } = useLoans()

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pozajmice i prijenosi"
        description="Evidencija pozajmica i prijenosa između firmi"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>
            Nova Pozajmica
          </Button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            placeholder="Pretraži pozajmice i prijenose..."
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Datum
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Daje
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Račun (Daje)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Prima
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Račun (Prima)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Iznos
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Akcije
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nema pozajmica
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(loan.loan_date), 'dd.MM.yyyy')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {loan.from_company.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        <div className="font-medium">{loan.from_bank_account.bank_name}</div>
                        {loan.from_bank_account.account_number && (
                          <div className="text-xs text-gray-500">{loan.from_bank_account.account_number}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {loan.to_company.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        <div className="font-medium">{loan.to_bank_account.bank_name}</div>
                        {loan.to_bank_account.account_number && (
                          <div className="text-xs text-gray-500">{loan.to_bank_account.account_number}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        €{loan.amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <Button variant="outline-danger" size="icon-sm" icon={Trash2} onClick={() => handleDeleteLoan(loan.id)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal show={showAddModal} onClose={() => { setShowAddModal(false); resetForm() }} size="md">
        <Modal.Header title="Nova Pozajmica" onClose={() => { setShowAddModal(false); resetForm() }} />
        <form onSubmit={handleAddLoan}>
          <Modal.Body>
            <FormField label="Daje" required>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Select
                  value={formData.from_company_id}
                  onChange={(e) => setFormData({ ...formData, from_company_id: e.target.value, from_bank_account_id: '' })}
                  className="pl-10"
                  required
                >
                  <option value="">Odaberite firmu</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </Select>
              </div>
            </FormField>

            {formData.from_company_id && (
              <FormField label="Račun (Daje)" required>
                <Select
                  value={formData.from_bank_account_id}
                  onChange={(e) => setFormData({ ...formData, from_bank_account_id: e.target.value })}
                  required
                >
                  <option value="">Odaberite račun</option>
                  {getFromCompanyAccounts().map(account => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} (Stanje: €{account.current_balance.toLocaleString('hr-HR', { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            <div className="border-t border-gray-200 pt-4"></div>

            <FormField label="Prima" required>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Select
                  value={formData.to_company_id}
                  onChange={(e) => setFormData({ ...formData, to_company_id: e.target.value, to_bank_account_id: '' })}
                  className="pl-10"
                  required
                >
                  <option value="">Odaberite firmu</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </Select>
              </div>
            </FormField>

            {formData.to_company_id && (
              <FormField label="Račun (Prima)" required>
                <Select
                  value={formData.to_bank_account_id}
                  onChange={(e) => setFormData({ ...formData, to_bank_account_id: e.target.value })}
                  required
                >
                  <option value="">Odaberite račun</option>
                  {getToCompanyAccounts().map(account => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} (Stanje: €{account.current_balance.toLocaleString('hr-HR', { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            <div className="border-t border-gray-200 pt-4"></div>

            <FormField label="Datum">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                <DateInput
                  value={formData.loan_date}
                  onChange={(value) => setFormData({ ...formData, loan_date: value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </FormField>

            <FormField label="Iznos" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">€</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="pl-8"
                  placeholder="0.00"
                  required
                />
              </div>
            </FormField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" type="button" onClick={() => { setShowAddModal(false); resetForm() }}>
              Odustani
            </Button>
            <Button variant="primary" type="submit">
              Spremi Pozajmicu
            </Button>
          </Modal.Footer>
        </form>
      </Modal>
    </div>
  )
}

export default AccountingLoans
