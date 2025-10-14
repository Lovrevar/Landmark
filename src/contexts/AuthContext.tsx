import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

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

  useEffect(() => {
    const savedAuth = localStorage.getItem('isAuthenticated')
    const savedProfile = localStorage.getItem('currentProfile')
    const savedUser = localStorage.getItem('user')

    if (savedAuth === 'true' && savedUser) {
      setIsAuthenticated(true)
      setUser(JSON.parse(savedUser))
      if (savedProfile && ['General', 'Supervision', 'Sales', 'Funding'].includes(savedProfile)) {
        setCurrentProfile(savedProfile as Profile)
      }
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, role')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle()

      if (error) {
        console.error('Login error:', error)
        return false
      }

      if (data) {
        const userData: User = {
          id: data.id,
          username: data.username,
          role: data.role as User['role']
        }

        setIsAuthenticated(true)
        setUser(userData)
        setCurrentProfile('General')
        localStorage.setItem('isAuthenticated', 'true')
        localStorage.setItem('currentProfile', 'General')
        localStorage.setItem('user', JSON.stringify(userData))
        return true
      }

      return false
    } catch (error) {
      console.error('Login exception:', error)
      return false
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUser(null)
    setCurrentProfile('General')
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('currentProfile')
    localStorage.removeItem('user')
    setTimeout(() => {
      window.location.href = '/'
    }, 100)
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