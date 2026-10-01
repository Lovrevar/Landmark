import { useTranslation } from 'react-i18next'
import * as siteService from '../services/siteService'
import { useToast } from '../../../../contexts/ToastContext'
import { toErrorMessage } from '../../../../lib/errorMessage'

export const useSubcontractorComments = () => {
  const { t } = useTranslation()
  const toast = useToast()

  /**
   * Rejects rather than returning `[]` on failure.
   *
   * Returning an empty list here made a failed read indistinguishable from a contract nobody has
   * commented on, and hid the failure from every caller above. The caller decides what to show.
   */
  const fetchSubcontractorComments = (subcontractorId: string) =>
    siteService.fetchSubcontractorComments(subcontractorId)

  const addSubcontractorComment = async (
    subcontractorId: string,
    userId: string,
    comment: string,
    commentType: 'completed' | 'issue' | 'general'
  ) => {
    if (!comment.trim()) return false

    try {
      await siteService.createSubcontractorComment({
        subcontractor_id: subcontractorId,
        user_id: userId,
        comment: comment.trim(),
        comment_type: commentType
      })
      toast.success(t('supervision.site_management.comments.add_success'))
      return true
    } catch (error) {
      console.error('Error adding comment:', error)
      // The caller keeps the typed comment in the box on a false return, so the message is the
      // only thing that explains why it is still there.
      toast.error(toErrorMessage(error, t('supervision.site_management.comments.add_failed')))
      return false
    }
  }

  return { fetchSubcontractorComments, addSubcontractorComment }
}
