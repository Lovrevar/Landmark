import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export interface ProjectAssignment {
  id: string
  project_id: string
  project_name: string
  assigned_at: string
}

export interface User {
  id: string
  auth_user_id: string
  username: string
  email: string
  role: 'Director' | 'Accounting' | 'Sales' | 'Supervision' | 'Investment'
  assignedProjects?: ProjectAssignment[]
}

export type Profile = 'General' | 'Supervision' | 'Sales' | 'Funding' | 'Cashflow' | 'Retail'

export type LoginErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'too_many_requests'
  | 'network_error'
  | 'no_user_record'
  | 'unknown'

export type AuthResult = { success: true } | { success: false; code: LoginErrorCode }

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  currentProfile: Profile
  setCurrentProfile: (profile: Profile) => void
  login: (email: string, password: string) => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
  logout: () => Promise<void>
  hasProjectAccess: (projectId: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentProfile, setCurrentProfile] = useState<Profile>(() => {
    const saved = localStorage.getItem('currentProfile')
    return (saved as Profile) || 'General'
  })

  const fetchUserData = async (authUser: SupabaseUser): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, auth_user_id, username, email, role')
        .eq('auth_user_id', authUser.id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user data:', error)
        return null
      }

      if (!data) {
        console.error('No user record found for auth_user_id:', authUser.id)
        return null
      }

      let assignedProjects: ProjectAssignment[] = []

      if (data.role === 'Supervision') {
        const { data: projectData, error: projectError } = await supabase
          .from('project_managers')
          .select(`
            id,
            project_id,
            assigned_at,
            projects:project_id (
              name
            )
          `)
          .eq('user_id', data.id)

        if (projectError) {
          console.warn('[auth] project_managers fetch failed for Supervision user', {
            userId: data.id,
            error: projectError,
          })
        } else if (projectData) {
          assignedProjects = (projectData as unknown as Array<{ id: string; project_id: string; assigned_at: string; projects?: { name: string } | null }>).map((pm) => ({
            id: pm.id,
            project_id: pm.project_id,
            project_name: pm.projects?.name || 'Unknown Project',
            assigned_at: pm.assigned_at
          }))
        }
      }

      return {
        id: data.id,
        auth_user_id: data.auth_user_id,
        username: data.username,
        email: data.email,
        role: data.role as User['role'],
        assignedProjects
      }
    } catch (error) {
      console.error('Exception fetching user data:', error)
      return null
    }
  }

  const handleAuthChange = (authUser: SupabaseUser | null) => {
    (async () => {
      if (authUser) {
        const userData = await fetchUserData(authUser)
        if (userData) {
          setUser(userData)
          setIsAuthenticated(true)
        } else {
          setUser(null)
          setIsAuthenticated(false)
        }
      } else {
        setUser(null)
        setIsAuthenticated(false)
      }
    })()
  }

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
        } else if (session?.user && mounted) {
          const userData = await fetchUserData(session.user)
          if (userData && mounted) {
            setUser(userData)
            setIsAuthenticated(true)
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        handleAuthChange(session?.user || null)
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null)
          setIsAuthenticated(false)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const mapAuthError = (error: unknown): LoginErrorCode => {
    if (!error || typeof error !== 'object') return 'unknown'
    const err = error as { message?: string; status?: number; code?: string; name?: string }
    const msg = (err.message || '').toLowerCase()
    const code = (err.code || '').toLowerCase()

    if (err.name === 'TypeError' && msg.includes('fetch')) return 'network_error'
    if (err.status === 429 || code.includes('rate_limit') || msg.includes('rate limit')) return 'too_many_requests'
    if (msg.includes('email not confirmed') || code === 'email_not_confirmed') return 'email_not_confirmed'
    if (msg.includes('invalid login credentials') || code === 'invalid_credentials') return 'invalid_credentials'
    return 'unknown'
  }

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        return { success: false, code: mapAuthError(error) }
      }

      if (data.user) {
        const userData = await fetchUserData(data.user)
        if (userData) {
          setUser(userData)
          setIsAuthenticated(true)
          setCurrentProfile('General')
          localStorage.setItem('currentProfile', 'General')
          logActivity({
            userId: userData.id,
            userRole: userData.role,
            action: 'auth.login',
            entity: 'user',
            entityId: userData.id,
            metadata: { severity: 'low' },
          })
          return { success: true }
        }
        return { success: false, code: 'no_user_record' }
      }

      return { success: false, code: 'unknown' }
    } catch (error) {
      return { success: false, code: mapAuthError(error) }
    }
  }

  const resetPassword = async (email: string): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password'
      })
      if (error) {
        return { success: false, code: mapAuthError(error) }
      }
      return { success: true }
    } catch (error) {
      return { success: false, code: mapAuthError(error) }
    }
  }

  const logout = async () => {
    if (user) {
      await logActivity({
        userId: user.id,
        userRole: user.role,
        action: 'auth.logout',
        entity: 'user',
        entityId: user.id,
        metadata: { severity: 'low' },
      })
    }
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      setIsAuthenticated(false)
      localStorage.removeItem('currentProfile')
      sessionStorage.removeItem('cashflow_unlocked')
    }
  }

  const handleSetCurrentProfile = (profile: Profile) => {
    setCurrentProfile(profile)
    localStorage.setItem('currentProfile', profile)
  }

  const hasProjectAccess = (projectId: string): boolean => {
    if (!user) return false

    if (user.role === 'Director') return true

    if (user.role === 'Supervision') {
      return user.assignedProjects?.some(p => p.project_id === projectId) || false
    }

    return false
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    loading,
    currentProfile,
    setCurrentProfile: handleSetCurrentProfile,
    login,
    resetPassword,
    logout,
    hasProjectAccess
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
