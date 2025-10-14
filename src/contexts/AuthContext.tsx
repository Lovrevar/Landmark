import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Profile = 'General' | 'Supervision' | 'Sales' | 'Funding'

interface AuthContextType {
  isAuthenticated: boolean
  currentProfile: Profile
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
  const [currentProfile, setCurrentProfile] = useState<Profile>('Director')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedAuth = localStorage.getItem('isAuthenticated')
    const savedProfile = localStorage.getItem('currentProfile')

    if (savedAuth === 'true') {
      setIsAuthenticated(true)
      if (savedProfile && ['General', 'Supervision', 'Sales', 'Funding'].includes(savedProfile)) {
        setCurrentProfile(savedProfile as Profile)
      }
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    if (username === 'admin' && password === 'admin') {
      setIsAuthenticated(true)
      setCurrentProfile('General')
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('currentProfile', 'General')
      return true
    }
    return false
  }

  const logout = () => {
    setIsAuthenticated(false)
    setCurrentProfile('General')
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('currentProfile')
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
    setCurrentProfile: handleSetCurrentProfile,
    login,
    logout,
    loading
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}