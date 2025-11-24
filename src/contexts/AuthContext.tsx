import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
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

export type Profile = 'General' | 'Supervision' | 'Sales' | 'Funding' | 'Accounting'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  currentProfile: Profile
  setCurrentProfile: (profile: Profile) => void
  login: (email: string, password: string) => Promise<boolean>
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

        if (!projectError && projectData) {
          assignedProjects = projectData.map((pm: any) => ({
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

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        console.error('Login failed:', response.statusText)
        return false
      }

      const { user: authUser, session } = await response.json()

      if (authUser && session) {
        localStorage.setItem('supabase.auth.token', JSON.stringify(session))

        const userData = await fetchUserData(authUser)
        if (userData) {
          setUser(userData)
          setIsAuthenticated(true)
          return true
        }
      }

      return false
    } catch (error) {
      console.error('Login exception:', error)
      return false
    }
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setIsAuthenticated(false)
      localStorage.removeItem('currentProfile')

      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
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
    logout,
    hasProjectAccess
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
