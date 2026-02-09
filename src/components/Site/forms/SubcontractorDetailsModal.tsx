import React, { useState, useEffect } from 'react'
import { MessageSquare, Send, Calendar, Building2, User } from 'lucide-react'
import { format } from 'date-fns'
import { Subcontractor } from '../../../lib/supabase'
import { CommentWithUser } from '../types/siteTypes'
import { supabase } from '../../../lib/supabase'
import { Modal, FormField, Select, Textarea, Button, Badge } from '../../ui'

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

  useEffect(() => {
    if (visible && subcontractor) {
      loadFunderInfo()
    } else {
      setFunderName(null)
    }
  }, [visible, subcontractor])

  const loadFunderInfo = async () => {
    if (!subcontractor) return

    if (!subcontractor.financed_by_type || (!subcontractor.financed_by_investor_id && !subcontractor.financed_by_bank_id)) {
      setFunderName(null)
      return
    }

    try {
      setLoadingFunder(true)
      if (subcontractor.financed_by_type === 'investor' && subcontractor.financed_by_investor_id) {
        const { data, error } = await supabase
          .from('investors')
          .select('name')
          .eq('id', subcontractor.financed_by_investor_id)
          .maybeSingle()

        if (!error && data) {
          setFunderName(data.name)
        }
      } else if (subcontractor.financed_by_type === 'bank' && subcontractor.financed_by_bank_id) {
        const { data, error } = await supabase
          .from('banks')
          .select('name')
          .eq('id', subcontractor.financed_by_bank_id)
          .maybeSingle()

        if (!error && data) {
          setFunderName(data.name)
        }
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
        <p className="text-gray-700">{subcontractor.job_description}</p>
            {subcontractor.has_contract !== false ? (
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Contract Amount (Base)</p>
                  <p className="text-lg font-bold text-gray-900">€{subcontractor.cost.toLocaleString('hr-HR')}</p>
                </div>
                <div className="bg-teal-50 p-3 rounded-lg">
                  <p className="text-xs text-teal-700 mb-1">Paid Amount (Base)</p>
                  <p className="text-lg font-bold text-teal-900">€{subcontractor.budget_realized.toLocaleString('hr-HR')}</p>
                </div>
                <div className={`p-3 rounded-lg ${
                  subcontractor.budget_realized > subcontractor.cost ? 'bg-red-50' :
                  subcontractor.budget_realized < subcontractor.cost ? 'bg-green-50' :
                  'bg-gray-50'
                }`}>
                  <p className={`text-xs mb-1 ${
                    subcontractor.budget_realized > subcontractor.cost ? 'text-red-700' :
                    subcontractor.budget_realized < subcontractor.cost ? 'text-green-700' :
                    'text-gray-600'
                  }`}>Gain/Loss</p>
                  <p className={`text-lg font-bold ${
                    subcontractor.budget_realized > subcontractor.cost ? 'text-red-900' :
                    subcontractor.budget_realized < subcontractor.cost ? 'text-green-900' :
                    'text-gray-900'
                  }`}>
                    {subcontractor.budget_realized > subcontractor.cost ? '-' :
                     subcontractor.budget_realized < subcontractor.cost ? '+' : ''}
                    €{Math.abs(subcontractor.budget_realized - subcontractor.cost).toLocaleString('hr-HR')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="bg-teal-50 p-4 rounded-lg border-2 border-teal-200">
                  <p className="text-sm text-teal-700 mb-1">Plaćeno ukupno</p>
                  <p className="text-2xl font-bold text-teal-900">€{subcontractor.budget_realized.toLocaleString('hr-HR')}</p>
                  <p className="text-xs text-teal-600 mt-2">Subkontraktor nema formalan ugovor - troškovi se prate kroz račune u Accounting modulu</p>
                </div>
              </div>
            )}
            {funderName && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center">
                  {subcontractor.financed_by_type === 'investor' ? (
                    <User className="w-4 h-4 text-blue-600 mr-2" />
                  ) : (
                    <Building2 className="w-4 h-4 text-blue-600 mr-2" />
                  )}
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Financed By</p>
                    <p className="text-sm font-semibold text-blue-900">{funderName}</p>
                  </div>
                </div>
              </div>
            )}
            {onManageMilestones && (
              <div className="mt-4">
                <Button
                  variant="amber"
                  icon={Calendar}
                  fullWidth
                  onClick={onManageMilestones}
                >
                  Manage Payment Milestones
                </Button>
              </div>
            )}

        <div className="flex-1 overflow-y-auto max-h-96 mt-6">
          <h4 className="font-medium text-gray-900 mb-4 flex items-center">
            <MessageSquare className="w-4 h-4 mr-2" />
            Supervision Comments
          </h4>

          <div className="space-y-4 mb-4">
            {comments.length === 0 ? (
              <p className="text-gray-500 text-sm">No supervision comments yet. Add the first comment!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className={`p-4 rounded-lg border ${
                  comment.comment_type === 'issue' ? 'bg-red-50 border-red-200' :
                  comment.comment_type === 'completed' ? 'bg-green-50 border-green-200' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{comment.user?.username}</span>
                      <span className="text-xs text-gray-500">({comment.user?.role})</span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        comment.comment_type === 'issue' ? 'bg-red-100 text-red-800' :
                        comment.comment_type === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {comment.comment_type === 'completed' ? 'Work Done' :
                         comment.comment_type === 'issue' ? 'Issue' : 'Note'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-gray-700">{comment.comment}</p>
                </div>
              ))
            )}
          </div>

        <div className="border-t pt-4">
          <FormField label="Comment Type">
            <Select
              value={commentType}
              onChange={(e) => onCommentTypeChange(e.target.value as 'completed' | 'issue' | 'general')}
            >
              <option value="general">General Note</option>
              <option value="completed">Work Completed</option>
              <option value="issue">Issue/Problem</option>
            </Select>
          </FormField>
          <div className="flex space-x-3 mt-3">
            <Textarea
              value={newComment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="Add supervision notes..."
              rows={3}
              className="flex-1 resize-none"
            />
            <Button
              onClick={onAddComment}
              disabled={!newComment.trim()}
              icon={Send}
              size="icon-md"
            />
          </div>
        </div>
        </div>
      </Modal.Body>
    </Modal>
  )
}
