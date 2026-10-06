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

/** Mirrors the accounting_invoices UPDATE policy; other roles would get a silent no-op. */
export const canApproveInvoices = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director' || user.role === 'Accounting'
}

export const canManageProjectPhases = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director'
}

/**
 * Who may switch into the Cashflow profile. Mirrors the RLS on the finance tables (Director and
 * Accounting); everyone else would get an empty, misleading dashboard (DEFECT_BACKLOG SEC-A8).
 */
export const canUseCashflow = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director' || user.role === 'Accounting'
}

export const isSupervisionRole = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Supervision'
}

export const isDirectorRole = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director'
}

export const canViewActivityLog = (user: User | null): boolean => {
  return isDirectorRole(user)
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

/**
 * Who may create or change a project's TIC — and with it the planned budget, since the TIC is its
 * only writer. Mirrors the "Funding roles can … TIC cost structures" policies
 * (20260930100400_funding_rename_and_tic_writes.sql): the three roles that work in the Funding
 * profile. Use it to decide whether to offer a way to the TIC, not as protection.
 */
export const canManageTIC = (user: User | null): boolean => {
  if (!user) return false
  return user.role === 'Director' || user.role === 'Accounting' || user.role === 'Investment'
}
