import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Send, Calendar, Building2, FileText, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { CommentWithUser, SubcontractorWithPhase } from '../types'
import { Modal, FormField, Select, Textarea, Button, Badge } from '../../../ui'
import { fetchContractDetails, fetchBankById, ContractDetailsRow } from '../services/siteService'
import { ContractDocumentViewer } from '../ContractDocumentViewer'
import { formatEuro } from '../../../../utils/formatters'

type ContractData = ContractDetailsRow

interface SubcontractorDetailsModalProps {
  visible: boolean
  onClose: () => void
  subcontractor: SubcontractorWithPhase | null
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
  const { t } = useTranslation()
  const [funderName, setFunderName] = useState<string | null>(null)
  const [, setLoadingFunder] = useState(false)
  const [contractData, setContractData] = useState<ContractData | null>(null)
  const [, setLoadingContract] = useState(false)

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
    const contractId = subcontractor.contract_id || subcontractor.id
    try {
      setLoadingContract(true)
      const data = await fetchContractDetails(contractId)
      if (data) setContractData(data)
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
      const name = await fetchBankById(subcontractor.financed_by_bank_id)
      setFunderName(name)
    } catch (error) {
      console.error('Error loading funder:', error)
    } finally {
      setLoadingFunder(false)
    }
  }

  if (!visible || !subcontractor) return null

  const realized = subcontractor.budget_realized ?? 0
  const contractCost = subcontractor.cost ?? 0

  const getBudgetStatus = () =>
    realized > contractCost ? t('supervision.subcontractor_details.status_over_budget') :
    realized === contractCost ? t('supervision.subcontractor_details.status_fully_paid') :
    realized > 0 ? t('supervision.subcontractor_details.status_partial') : t('supervision.subcontractor_details.status_unpaid')

  const getBudgetVariant = (): 'red' | 'green' | 'blue' | 'gray' => {
    if (realized > contractCost) return 'red'
    if (realized === contractCost) return 'green'
    if (realized > 0) return 'blue'
    return 'gray'
  }

  return (
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header title={subcontractor.name} onClose={onClose}>
        <div className="flex items-center gap-2 mt-2">
          {subcontractor.has_contract === false && (
            <Badge variant="yellow" size="sm">
              {t('supervision.subcontractor_details.no_contract_badge')}
            </Badge>
          )}
          {subcontractor.has_contract !== false && (
            <Badge variant={getBudgetVariant()} size="sm">
              {getBudgetStatus()}
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
              <h3 className="text-sm font-semibold text-gray-900">{t('supervision.subcontractor_details.job_description')}</h3>
            </div>
            <p className="text-gray-700 text-sm">{subcontractor.job_description || t('supervision.subcontractor_details.no_description')}</p>
          </div>

          {/* Contract Information */}
          {subcontractor.has_contract !== false && contractData && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="text-sm font-semibold text-blue-900">{t('supervision.subcontractor_details.contract_details')}</h3>
                </div>
                {contractData.contract_type_name && (
                  <Badge variant="blue" size="sm">{contractData.contract_type_name}</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-blue-700">{t('supervision.subcontractor_details.contract_number')}</p>
                  <p className="text-sm font-semibold text-blue-900">{contractData.contract_number}</p>
                </div>
                {contractData.end_date && (
                  <div>
                    <p className="text-xs text-blue-700">{t('supervision.subcontractor_details.deadline')}</p>
                    <p className="text-sm font-semibold text-blue-900">
                      {format(new Date(contractData.end_date), 'dd.MM.yyyy')}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white p-3 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">{t('supervision.subcontractor_details.base')}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatEuro(contractData.base_amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">{t('supervision.subcontractor_details.vat')} ({contractData.vat_rate}%)</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatEuro(contractData.vat_amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-900">{t('common.total')}</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatEuro(contractData.total_amount)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Contract Documents */}
          {subcontractor.has_contract !== false && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">{t('supervision.subcontractor_details.contract_docs')}</h3>
              </div>
              <ContractDocumentViewer
                subcontractorId={subcontractor.subcontractor_id || subcontractor.id}
                readOnly
              />
            </div>
          )}

          {/* Payment Status */}
          {subcontractor.has_contract !== false ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 text-gray-600 mr-1" />
                  <p className="text-xs text-gray-600">{t('supervision.subcontractor_details.contracted_base')}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {formatEuro(contractData?.base_amount ?? contractCost)}
                </p>
              </div>

              <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 text-teal-600 mr-1" />
                  <p className="text-xs text-teal-700">{t('supervision.subcontractor_details.paid_base')}</p>
                </div>
                <p className="text-xl font-bold text-teal-900">
                  {formatEuro(realized)}
                </p>
              </div>

              <div className={`p-4 rounded-lg border ${
                realized > (contractData?.base_amount ?? contractCost) ? 'bg-red-50 border-red-200' :
                realized < (contractData?.base_amount ?? contractCost) ? 'bg-green-50 border-green-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 mr-1" />
                  <p className={`text-xs ${
                    realized > (contractData?.base_amount ?? contractCost) ? 'text-red-700' :
                    realized < (contractData?.base_amount ?? contractCost) ? 'text-green-700' :
                    'text-gray-600'
                  }`}>{t('supervision.subcontractor_details.gain_loss')}</p>
                </div>
                <p className={`text-xl font-bold ${
                  realized > (contractData?.base_amount ?? contractCost) ? 'text-red-900' :
                  realized < (contractData?.base_amount ?? contractCost) ? 'text-green-900' :
                  'text-gray-900'
                }`}>
                  {realized > (contractData?.base_amount ?? contractCost) ? '-' :
                   realized < (contractData?.base_amount ?? contractCost) ? '+' : ''}
                  {formatEuro(Math.abs(realized - (contractData?.base_amount ?? contractCost)))}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
              <div className="flex items-center mb-2">
                <FileText className="w-5 h-5 text-yellow-700 mr-2" />
                <h3 className="text-sm font-semibold text-yellow-900">{t('supervision.subcontractor_details.no_contract_heading')}</h3>
              </div>
              <div className="bg-white p-3 rounded-lg mt-3">
                <p className="text-xs text-yellow-700 mb-1">{t('supervision.subcontractor_details.total_paid')}</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {formatEuro(realized)}
                </p>
              </div>
              <p className="text-xs text-yellow-700 mt-3">
                {t('supervision.subcontractor_details.accounting_note')}
              </p>
            </div>
          )}

          {/* Financing Information */}
          {funderName && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <Building2 className="w-5 h-5 text-blue-600 mr-2" />
                <div>
                  <p className="text-xs text-blue-700 font-medium">{t('supervision.subcontractor_details.financed_by')}</p>
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
              {t('supervision.subcontractor_details.manage_milestones')}
            </Button>
          )}

          {/* Supervision Comments Section */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-gray-600" />
              {t('supervision.subcontractor_details.comments')}
            </h4>

            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {comments.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">{t('supervision.subcontractor_details.no_comments')}</p>
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
                          {comment.comment_type === 'completed' ? t('supervision.subcontractor_details.work_finished_type') :
                           comment.comment_type === 'issue' ? t('supervision.subcontractor_details.problem_type') : t('supervision.subcontractor_details.note_type')}
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
              <FormField label={t('supervision.subcontractor_details.comment_type')}>
                <Select
                  value={commentType}
                  onChange={(e) => onCommentTypeChange(e.target.value as 'completed' | 'issue' | 'general')}
                >
                  <option value="general">{t('supervision.subcontractor_details.note_type')}</option>
                  <option value="completed">{t('supervision.subcontractor_details.work_finished_type')}</option>
                  <option value="issue">{t('supervision.subcontractor_details.problem_type')}</option>
                </Select>
              </FormField>
              <div className="flex space-x-3 mt-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => onCommentChange(e.target.value)}
                  placeholder={t('supervision.subcontractor_details.comment_placeholder')}
                  rows={3}
                  className="flex-1 resize-none"
                />
                <Button
                  onClick={onAddComment}
                  disabled={!newComment.trim()}
                  icon={Send}
                  size="icon-md"
                  title={t('supervision.subcontractor_details.add_comment')}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  )
}
