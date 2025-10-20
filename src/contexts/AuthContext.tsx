import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export interface User {
  id: string
  auth_user_id: string
  username: string
  email: string
  role: 'Director' | 'Accounting' | 'Sales' | 'Supervision' | 'Investment'
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  logout: () => Promise<void>
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

      return {
        id: data.id,
        auth_user_id: data.auth_user_id,
        username: data.username,
        email: data.email,
        role: data.role as User['role']
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

  const logout = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setIsAuthenticated(false)

      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    loading,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
