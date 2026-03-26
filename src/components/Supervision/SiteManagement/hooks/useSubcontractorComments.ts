import * as siteService from '../services/siteService'

export const useSubcontractorComments = () => {
  const fetchSubcontractorComments = async (subcontractorId: string) => {
    try {
      return await siteService.fetchSubcontractorComments(subcontractorId)
    } catch (error) {
      console.error('Error fetching comments:', error)
      return []
    }
  }

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
      return true
    } catch (error) {
      console.error('Error adding comment:', error)
      return false
    }
  }

  return { fetchSubcontractorComments, addSubcontractorComment }
}
