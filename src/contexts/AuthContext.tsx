/* eslint-disable react-refresh/only-export-components */
// Co-locates AuthProvider with the useAuth hook + exported types (idiomatic
// context pattern); the mixed-exports warning is a fast-refresh DX concern.
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import type { User as SupabaseUser } from '@supabase/supabase-js'

// Survives the full-page redirect to Microsoft and back, so the SIGNED_IN
// handler can tell a returning OAuth round trip from an ordinary session
// restore and report/log it accordingly.
const SSO_PENDING_KEY = 'sso_redirect_pending'

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
  | 'sso_not_provisioned'
  | 'unknown'

export type AuthResult = { success: true } | { success: false; code: LoginErrorCode }

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  currentProfile: Profile
  setCurrentProfile: (profile: Profile) => void
  login: (email: string, password: string) => Promise<AuthResult>
  loginWithMicrosoft: () => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
  logout: () => Promise<void>
  /** Set when a redirect-based sign-in fails after the OAuth round trip. */
  authError: LoginErrorCode | null
  clearAuthError: () => void
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
  const [authError, setAuthError] = useState<LoginErrorCode | null>(null)
  const [currentProfile, setCurrentProfile] = useState<Profile>(() => {
    const saved = localStorage.getItem('currentProfile')
    return (saved as Profile) || 'General'
  })

  const fetchUserData = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
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
  }, [])

  // A session with no public.users row is an authenticated identity with no
  // app account — the state a Microsoft sign-in lands in when nobody has
  // provisioned the person. Drop the session so it cannot linger, and say why.
  const rejectUnprovisionedSession = useCallback(async (viaSso: boolean) => {
    setUser(null)
    setIsAuthenticated(false)
    setAuthError(viaSso ? 'sso_not_provisioned' : 'no_user_record')
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('[auth] sign-out after unprovisioned session failed:', error)
    }
  }, [])

  const handleAuthChange = useCallback((authUser: SupabaseUser | null) => {
    (async () => {
      if (!authUser) {
        setUser(null)
        setIsAuthenticated(false)
        return
      }

      const viaSso = sessionStorage.getItem(SSO_PENDING_KEY) === '1'
      const userData = await fetchUserData(authUser)

      if (!userData) {
        sessionStorage.removeItem(SSO_PENDING_KEY)
        await rejectUnprovisionedSession(viaSso)
        return
      }

      setUser(userData)
      setIsAuthenticated(true)
      setAuthError(null)

      if (viaSso) {
        // The redirect skips login(), so do its bookkeeping here instead.
        sessionStorage.removeItem(SSO_PENDING_KEY)
        setCurrentProfile('General')
        localStorage.setItem('currentProfile', 'General')
        logActivity({
          userId: userData.id,
          userRole: userData.role,
          action: 'auth.login',
          entity: 'user',
          entityId: userData.id,
          metadata: { severity: 'low', method: 'microsoft' },
        })
      }
    })()
  }, [fetchUserData, rejectUnprovisionedSession])

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
        } else if (session?.user && mounted) {
          const userData = await fetchUserData(session.user)
          if (!mounted) return
          if (userData) {
            setUser(userData)
            setIsAuthenticated(true)
          } else {
            await rejectUnprovisionedSession(sessionStorage.getItem(SSO_PENDING_KEY) === '1')
            sessionStorage.removeItem(SSO_PENDING_KEY)
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
  }, [fetchUserData, handleAuthChange, rejectUnprovisionedSession])

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
    // Clear a marker left behind by an OAuth attempt the user abandoned at
    // Microsoft, so this sign-in is not logged as one.
    sessionStorage.removeItem(SSO_PENDING_KEY)
    setAuthError(null)
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

  /**
   * Redirects to Microsoft (Entra ID). On success the browser comes back to
   * the app with tokens in the URL, supabase-js picks them up
   * (detectSessionInUrl) and fires SIGNED_IN, which handleAuthChange handles.
   * A resolved { success: true } here only means the redirect was issued.
   */
  const loginWithMicrosoft = async (): Promise<AuthResult> => {
    setAuthError(null)
    try {
      sessionStorage.setItem(SSO_PENDING_KEY, '1')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'openid email profile',
          redirectTo: window.location.origin,
        },
      })

      if (error) {
        sessionStorage.removeItem(SSO_PENDING_KEY)
        return { success: false, code: mapAuthError(error) }
      }

      return { success: true }
    } catch (error) {
      sessionStorage.removeItem(SSO_PENDING_KEY)
      return { success: false, code: mapAuthError(error) }
    }
  }

  const clearAuthError = () => setAuthError(null)

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
      setAuthError(null)
      localStorage.removeItem('currentProfile')
      sessionStorage.removeItem('cashflow_unlocked')
      sessionStorage.removeItem(SSO_PENDING_KEY)
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
    loginWithMicrosoft,
    resetPassword,
    logout,
    authError,
    clearAuthError,
    hasProjectAccess
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
