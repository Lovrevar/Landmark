import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export type Profile = 'General' | 'Supervision' | 'Sales' | 'Funding'

export interface User {
  id: string
  username: string
  role: 'Director' | 'Accounting' | 'Sales' | 'Supervision' | 'Investment'
}

interface AuthContextType {
  isAuthenticated: boolean
  currentProfile: Profile
  user: User | null
  setCurrentProfile: (profile: Profile) => void
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
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
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentProfile, setCurrentProfile] = useState<Profile>('General')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUserData = async (authUser: SupabaseUser) => {
    try {
      console.log('Loading user data for auth_user_id:', authUser.id)
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, username, role, email')
        .eq('auth_user_id', authUser.id)
        .maybeSingle()

      console.log('User data result:', { userData, error })

      if (error) {
        console.error('Error loading user data:', error)
        return null
      }

      if (userData) {
        const user: User = {
          id: userData.id,
          username: userData.username,
          role: userData.role as User['role']
        }
        console.log('Loaded user:', user)
        return user
      }

      console.log('No user data found')
      return null
    } catch (error) {
      console.error('Exception loading user data:', error)
      return null
    }
  }

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
          setLoading(false)
          return
        }

        if (session?.user && mounted) {
          const userData = await loadUserData(session.user)
          if (userData && mounted) {
            setUser(userData)
            setIsAuthenticated(true)
          } else if (mounted) {
            // If we have a session but no user data, sign out
            await supabase.auth.signOut()
          }
        }

        const savedProfile = localStorage.getItem('currentProfile')
        if (savedProfile && ['General', 'Supervision', 'Sales', 'Funding'].includes(savedProfile)) {
          setCurrentProfile(savedProfile as Profile)
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('Auth state changed:', event)

      if (event === 'SIGNED_IN' && session?.user) {
        const userData = await loadUserData(session.user)
        if (userData && mounted) {
          setUser(userData)
          setIsAuthenticated(true)
        } else if (mounted) {
          // If we can't load user data, sign out
          await supabase.auth.signOut()
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null)
          setIsAuthenticated(false)
          setCurrentProfile('General')
          localStorage.removeItem('currentProfile')
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        const userData = await loadUserData(session.user)
        if (userData && mounted) {
          setUser(userData)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const email = `${username}@landmark.local`

      let authResult = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authResult.error) {
        if (authResult.error.message.includes('Invalid login credentials')) {
          console.log('User does not exist, attempting to create admin account...')

          if (username === 'admin' && password === 'admin123') {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  username: 'admin',
                  role: 'Director'
                },
                emailRedirectTo: undefined
              }
            })

            if (signUpError) {
              console.error('Sign up error:', signUpError)
              return false
            }

            if (signUpData.user) {
              await new Promise(resolve => setTimeout(resolve, 1000))

              await supabase
                .from('users')
                .update({ role: 'Director' })
                .eq('auth_user_id', signUpData.user.id)

              authResult = await supabase.auth.signInWithPassword({
                email,
                password
              })

              if (authResult.error) {
                console.error('Login after signup error:', authResult.error)
                return false
              }
            }
          } else {
            console.error('Invalid credentials')
            return false
          }
        } else {
          console.error('Login error:', authResult.error)
          return false
        }
      }

      if (authResult.data?.user) {
        const userData = await loadUserData(authResult.data.user)
        if (userData) {
          setUser(userData)
          setIsAuthenticated(true)
          setCurrentProfile('General')
          localStorage.setItem('currentProfile', 'General')
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
      setIsAuthenticated(false)
      setUser(null)
      setCurrentProfile('General')
      localStorage.removeItem('currentProfile')

      setTimeout(() => {
        window.location.href = '/'
      }, 100)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleSetCurrentProfile = (profile: Profile) => {
    setCurrentProfile(profile)
    localStorage.setItem('currentProfile', profile)
  }

  const value = {
    isAuthenticated,
    currentProfile,
    user,
    setCurrentProfile: handleSetCurrentProfile,
    login,
    logout,
    loading
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
