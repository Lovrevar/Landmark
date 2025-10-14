import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type CompanyProfile = 'Director' | 'Accounting' | 'Sales' | 'Supervision' | 'Investment'

interface AuthContextType {
  isAuthenticated: boolean
  currentProfile: CompanyProfile
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  switchProfile: (profile: CompanyProfile) => void
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
  const [currentProfile, setCurrentProfile] = useState<CompanyProfile>('Director')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedAuth = localStorage.getItem('adminAuthenticated')
    const savedProfile = localStorage.getItem('currentProfile')

    if (savedAuth === 'true') {
      setIsAuthenticated(true)
      if (savedProfile) {
        setCurrentProfile(savedProfile as CompanyProfile)
      }
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    if (username === 'admin' && password === 'admin') {
      setIsAuthenticated(true)
      setCurrentProfile('Director')
      localStorage.setItem('adminAuthenticated', 'true')
      localStorage.setItem('currentProfile', 'Director')
      return true
    }
    return false
  }

  const logout = () => {
    setIsAuthenticated(false)
    setCurrentProfile('Director')
    localStorage.removeItem('adminAuthenticated')
    localStorage.removeItem('currentProfile')
    setTimeout(() => {
      window.location.href = '/'
    }, 100)
  }

  const switchProfile = (profile: CompanyProfile) => {
    setCurrentProfile(profile)
    localStorage.setItem('currentProfile', profile)
  }

  const value = {
    isAuthenticated,
    currentProfile,
    login,
    logout,
    switchProfile,
    loading
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}