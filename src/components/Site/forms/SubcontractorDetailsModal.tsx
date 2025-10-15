import React from 'react'
import { X, MessageSquare, Send } from 'lucide-react'
import { format } from 'date-fns'
import { Subcontractor } from '../../../lib/supabase'
import { CommentWithUser } from '../types/siteTypes'

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
  onAddComment
}) => {
  if (!visible || !subcontractor) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{subcontractor.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{subcontractor.contact}</p>
              <div className="flex items-center space-x-3 mt-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  subcontractor.budget_realized > subcontractor.cost ? 'bg-red-100 text-red-800' :
                  subcontractor.budget_realized === subcontractor.cost ? 'bg-green-100 text-green-800' :
                  subcontractor.budget_realized > 0 ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {subcontractor.budget_realized > subcontractor.cost ? 'Over Budget' :
                   subcontractor.budget_realized === subcontractor.cost ? 'Fully Paid' :
                   subcontractor.budget_realized > 0 ? 'Partial Payment' : 'Unpaid'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="mt-4">
            <p className="text-gray-700">{subcontractor.job_description}</p>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Contract Amount</p>
                <p className="text-lg font-bold text-gray-900">€{subcontractor.cost.toLocaleString()}</p>
              </div>
              <div className="bg-teal-50 p-3 rounded-lg">
                <p className="text-xs text-teal-700 mb-1">Paid Amount</p>
                <p className="text-lg font-bold text-teal-900">€{subcontractor.budget_realized.toLocaleString()}</p>
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
                  €{Math.abs(subcontractor.budget_realized - subcontractor.cost).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-96 p-6">
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
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment Type
              </label>
              <select
                value={commentType}
                onChange={(e) => onCommentTypeChange(e.target.value as 'completed' | 'issue' | 'general')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="general">General Note</option>
                <option value="completed">Work Completed</option>
                <option value="issue">Issue/Problem</option>
              </select>
            </div>
            <div className="flex space-x-3">
              <textarea
                value={newComment}
                onChange={(e) => onCommentChange(e.target.value)}
                placeholder="Add supervision notes..."
                rows={3}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <button
                onClick={onAddComment}
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
