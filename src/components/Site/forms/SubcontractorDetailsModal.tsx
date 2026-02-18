import React, { useState, useEffect } from 'react'
import { MessageSquare, Send, Calendar, Building2, FileText, Clock, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { Subcontractor } from '../../../lib/supabase'
import { CommentWithUser } from '../types/siteTypes'
import { supabase } from '../../../lib/supabase'
import { Modal, FormField, Select, Textarea, Button, Badge } from '../../ui'

interface ContractData {
  contract_number: string
  base_amount: number
  vat_rate: number
  vat_amount: number
  total_amount: number
  end_date: string
  contract_type_name?: string
  status: string
}

interface SubcontractorDetailsModalProps {
  visible: boolean
  onClose: () => void
  subcontractor: Subcontractor | null
  comments: CommentWithUser[]
  newComment: string
  commentType: 'completed' | 'issue' | 'general'
  onCommentChange: (comment: string) => void
  onCommentTypeChange: (type: 'completed' | 'issue' | 'general') => void
  onAddComment: () => void
  onManageMilestones?: () => void
}

export const SubcontractorDetailsModal: React.FC<SubcontractorDetailsModalProps> = ({
  visible,
  onClose,
  subcontractor,
  comments,
  newComment,
  commentType,
  onCommentChange,
  onCommentTypeChange,
  onAddComment,
  onManageMilestones
}) => {
  const [funderName, setFunderName] = useState<string | null>(null)
  const [loadingFunder, setLoadingFunder] = useState(false)
  const [contractData, setContractData] = useState<ContractData | null>(null)
  const [loadingContract, setLoadingContract] = useState(false)

  useEffect(() => {
    if (visible && subcontractor) {
      loadFunderInfo()
      loadContractData()
    } else {
      setFunderName(null)
      setContractData(null)
    }
  }, [visible, subcontractor])

  const loadContractData = async () => {
    if (!subcontractor) return

    const contractId = (subcontractor as any).contract_id || subcontractor.id

    try {
      setLoadingContract(true)
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          contract_number,
          base_amount,
          vat_rate,
          vat_amount,
          total_amount,
          end_date,
          status,
          contract_types:contract_type_id(name)
        `)
        .eq('id', contractId)
        .maybeSingle()

      if (!error && data) {
        setContractData({
          contract_number: data.contract_number,
          base_amount: data.base_amount || 0,
          vat_rate: data.vat_rate || 0,
          vat_amount: data.vat_amount || 0,
          total_amount: data.total_amount || 0,
          end_date: data.end_date,
          contract_type_name: (data.contract_types as any)?.name,
          status: data.status
        })
      }
    } catch (error) {
      console.error('Error loading contract data:', error)
    } finally {
      setLoadingContract(false)
    }
  }

  const loadFunderInfo = async () => {
    if (!subcontractor) return

    if (!subcontractor.financed_by_bank_id) {
      setFunderName(null)
      return
    }

    try {
      setLoadingFunder(true)
      const { data, error } = await supabase
        .from('banks')
        .select('name')
        .eq('id', subcontractor.financed_by_bank_id)
        .maybeSingle()

      if (!error && data) {
        setFunderName(data.name)
      }
    } catch (error) {
      console.error('Error loading funder:', error)
    } finally {
      setLoadingFunder(false)
    }
  }

  const getVariant = (status: string): 'red' | 'green' | 'blue' | 'gray' => {
    if (subcontractor.budget_realized > subcontractor.cost) return 'red'
    if (subcontractor.budget_realized === subcontractor.cost) return 'green'
    if (subcontractor.budget_realized > 0) return 'blue'
    return 'gray'
  }

  if (!visible || !subcontractor) return null

  return (
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header title={subcontractor.name} onClose={onClose}>
        <div className="flex items-center gap-2 mt-2">
          {subcontractor.has_contract === false && (
            <Badge variant="yellow" size="sm">
              BEZ UGOVORA
            </Badge>
          )}
          {subcontractor.has_contract !== false && (
            <Badge
              variant={getVariant(
                subcontractor.budget_realized > subcontractor.cost ? 'Over Budget' :
                subcontractor.budget_realized === subcontractor.cost ? 'Fully Paid' :
                subcontractor.budget_realized > 0 ? 'Partial Payment' : 'Unpaid'
              )}
              size="sm"
            >
              {subcontractor.budget_realized > subcontractor.cost ? 'Over Budget' :
               subcontractor.budget_realized === subcontractor.cost ? 'Fully Paid' :
               subcontractor.budget_realized > 0 ? 'Partial Payment' : 'Unpaid'}
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">{subcontractor.contact}</p>
      </Modal.Header>

      <Modal.Body>
        <div className="space-y-6">
          {/* Job Description */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center mb-2">
              <FileText className="w-4 h-4 text-gray-600 mr-2" />
              <h3 className="text-sm font-semibold text-gray-900">Opis posla</h3>
            </div>
            <p className="text-gray-700 text-sm">{subcontractor.job_description || 'Nema opisa'}</p>
          </div>

          {/* Contract Information */}
          {subcontractor.has_contract !== false && contractData && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="text-sm font-semibold text-blue-900">Detalji ugovora</h3>
                </div>
                {contractData.contract_type_name && (
                  <Badge variant="blue" size="sm">{contractData.contract_type_name}</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-blue-700">Broj ugovora</p>
                  <p className="text-sm font-semibold text-blue-900">{contractData.contract_number}</p>
                </div>
                {contractData.end_date && (
                  <div>
                    <p className="text-xs text-blue-700">Rok</p>
                    <p className="text-sm font-semibold text-blue-900">
                      {format(new Date(contractData.end_date), 'dd.MM.yyyy')}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white p-3 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Osnovica</span>
                  <span className="text-sm font-semibold text-gray-900">
                    €{contractData.base_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">PDV ({contractData.vat_rate}%)</span>
                  <span className="text-sm font-semibold text-gray-900">
                    €{contractData.vat_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-900">Ukupno</span>
                  <span className="text-lg font-bold text-blue-600">
                    €{contractData.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Status */}
          {subcontractor.has_contract !== false ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 text-gray-600 mr-1" />
                  <p className="text-xs text-gray-600">Ugovoreno (osnova)</p>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  €{(contractData?.base_amount || subcontractor.cost).toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 text-teal-600 mr-1" />
                  <p className="text-xs text-teal-700">Plaćeno (osnova)</p>
                </div>
                <p className="text-xl font-bold text-teal-900">
                  €{subcontractor.budget_realized.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className={`p-4 rounded-lg border ${
                subcontractor.budget_realized > (contractData?.base_amount || subcontractor.cost) ? 'bg-red-50 border-red-200' :
                subcontractor.budget_realized < (contractData?.base_amount || subcontractor.cost) ? 'bg-green-50 border-green-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 mr-1" />
                  <p className={`text-xs ${
                    subcontractor.budget_realized > (contractData?.base_amount || subcontractor.cost) ? 'text-red-700' :
                    subcontractor.budget_realized < (contractData?.base_amount || subcontractor.cost) ? 'text-green-700' :
                    'text-gray-600'
                  }`}>Gain/Loss</p>
                </div>
                <p className={`text-xl font-bold ${
                  subcontractor.budget_realized > (contractData?.base_amount || subcontractor.cost) ? 'text-red-900' :
                  subcontractor.budget_realized < (contractData?.base_amount || subcontractor.cost) ? 'text-green-900' :
                  'text-gray-900'
                }`}>
                  {subcontractor.budget_realized > (contractData?.base_amount || subcontractor.cost) ? '-' :
                   subcontractor.budget_realized < (contractData?.base_amount || subcontractor.cost) ? '+' : ''}
                  €{Math.abs(subcontractor.budget_realized - (contractData?.base_amount || subcontractor.cost)).toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
              <div className="flex items-center mb-2">
                <FileText className="w-5 h-5 text-yellow-700 mr-2" />
                <h3 className="text-sm font-semibold text-yellow-900">Bez formalnog ugovora</h3>
              </div>
              <div className="bg-white p-3 rounded-lg mt-3">
                <p className="text-xs text-yellow-700 mb-1">Plaćeno ukupno</p>
                <p className="text-2xl font-bold text-yellow-900">
                  €{subcontractor.budget_realized.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-xs text-yellow-700 mt-3">
                Troškovi se prate kroz račune u Accounting modulu
              </p>
            </div>
          )}

          {/* Financing Information */}
          {funderName && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <Building2 className="w-5 h-5 text-blue-600 mr-2" />
                <div>
                  <p className="text-xs text-blue-700 font-medium">Financira</p>
                  <p className="text-sm font-semibold text-blue-900">{funderName}</p>
                </div>
              </div>
            </div>
          )}

          {/* Milestone Management Button */}
          {onManageMilestones && (
            <Button
              variant="amber"
              icon={Calendar}
              fullWidth
              onClick={onManageMilestones}
            >
              Manage Payment Milestones
            </Button>
          )}

          {/* Supervision Comments Section */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-gray-600" />
              Supervision Comments
            </h4>

            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {comments.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Nema komentara. Dodaj prvi komentar!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className={`p-3 rounded-lg border ${
                    comment.comment_type === 'issue' ? 'bg-red-50 border-red-200' :
                    comment.comment_type === 'completed' ? 'bg-green-50 border-green-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900 text-sm">{comment.user?.username}</span>
                        <span className="text-xs text-gray-500">({comment.user?.role})</span>
                        <Badge
                          variant={
                            comment.comment_type === 'issue' ? 'red' :
                            comment.comment_type === 'completed' ? 'green' :
                            'blue'
                          }
                          size="sm"
                        >
                          {comment.comment_type === 'completed' ? 'Završeno' :
                           comment.comment_type === 'issue' ? 'Problem' : 'Napomena'}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm">{comment.comment}</p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <FormField label="Tip komentara">
                <Select
                  value={commentType}
                  onChange={(e) => onCommentTypeChange(e.target.value as 'completed' | 'issue' | 'general')}
                >
                  <option value="general">Napomena</option>
                  <option value="completed">Posao završen</option>
                  <option value="issue">Problem</option>
                </Select>
              </FormField>
              <div className="flex space-x-3 mt-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => onCommentChange(e.target.value)}
                  placeholder="Dodaj komentar nadzora..."
                  rows={3}
                  className="flex-1 resize-none"
                />
                <Button
                  onClick={onAddComment}
                  disabled={!newComment.trim()}
                  icon={Send}
                  size="icon-md"
                  title="Dodaj komentar"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  )
}
