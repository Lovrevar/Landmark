import { User } from '../contexts/AuthContext'

export const canManagePayments = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director' || user.role === 'Accounting' || user.role === 'Investment'
}

export const canViewAllProjects = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director' || user.role === 'Accounting' || user.role === 'Investment' || user.role === 'Sales'
}

export const canManageSubcontractors = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director' || user.role === 'Supervision'
}

export const canManageWorkLogs = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director' || user.role === 'Supervision'
}

export const canManageProjectPhases = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director'
}

export const isSupervisionRole = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Supervision'
}

export const isDirectorRole = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director'
}

export const getAccessibleProjectIds = (user: User | null): string[] => {
  if (!user) return []

  if (canViewAllProjects(user)) {
    return []
  }

  if (user.role === 'Supervision' && user.assignedProjects) {
    return user.assignedProjects.map(p => p.project_id)
  }

  return []
}
