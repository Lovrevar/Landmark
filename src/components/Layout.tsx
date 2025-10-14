import React, { ReactNode, useState, useEffect, useRef } from 'react'
import { useAuth, CompanyProfile } from '../contexts/AuthContext'
import {
  Building2,
  LogOut,
  BarChart3,
  Calculator,
  Home,
  Users,
  Calendar,
  DollarSign,
  ChevronDown,
  Briefcase,
  TrendingUp,
  HardHat,
  PieChart
} from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentProfile, logout, switchProfile } = useAuth()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  const profiles: { name: CompanyProfile; icon: any; color: string }[] = [
    { name: 'Director', icon: Briefcase, color: 'text-blue-600' },
    { name: 'Accounting', icon: Calculator, color: 'text-green-600' },
    { name: 'Sales', icon: TrendingUp, color: 'text-purple-600' },
    { name: 'Supervision', icon: HardHat, color: 'text-orange-600' },
    { name: 'Investment', icon: PieChart, color: 'text-cyan-600' }
  ]

  const currentProfileData = profiles.find(p => p.name === currentProfile) || profiles[0]
  const ProfileIcon = currentProfileData.icon

  const menuItems = [
    { name: 'Dashboard', icon: BarChart3, path: '/' },
    { name: 'Calendar', icon: Calendar, path: '/calendar' },
    { name: 'Subcontractors', icon: Users, path: '/subcontractors' },
    { name: 'Site Management', icon: Building2, path: '/site-management' },
    { name: 'Sales Projects', icon: Building2, path: '/sales-projects' },
    { name: 'Customers', icon: Users, path: '/customers' },
    { name: 'Sales Reports', icon: BarChart3, path: '/sales-reports' },
    { name: 'Banks', icon: Building2, path: '/banks' },
    { name: 'Investment Projects', icon: Building2, path: '/investment-projects' },
    { name: 'Investors', icon: Users, path: '/investors' },
    { name: 'Payments', icon: DollarSign, path: '/payments' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Building2 className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Construction Project Management</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <ProfileIcon className={`w-5 h-5 ${currentProfileData.color}`} />
                  <span className="text-sm font-medium text-gray-900">{currentProfile}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-3 py-2 border-b border-gray-200">
                      <p className="text-xs text-gray-500 uppercase font-semibold">Switch Profile</p>
                    </div>
                    {profiles.map((profile) => {
                      const Icon = profile.icon
                      return (
                        <button
                          key={profile.name}
                          onClick={() => {
                            switchProfile(profile.name)
                            setShowProfileMenu(false)
                          }}
                          className={`w-full flex items-center space-x-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors duration-200 ${
                            currentProfile === profile.name ? 'bg-blue-50' : ''
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${profile.color}`} />
                          <span className="text-gray-900">{profile.name}</span>
                          {currentProfile === profile.name && (
                            <span className="ml-auto text-blue-600 text-xs font-medium">Active</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <button
                onClick={logout}
                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:text-red-600 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
          <nav className="p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.path}
                    className="flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors duration-200"
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout