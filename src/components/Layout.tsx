import React, { ReactNode, useState } from 'react'
import { useAuth, Profile } from '../contexts/AuthContext'
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
  User
} from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentProfile, setCurrentProfile, logout } = useAuth()
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  const getMenuItems = () => {
    const menuConfig = {
      General: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Projects', icon: Building2, path: '/projects' },
        { name: 'Payments', icon: DollarSign, path: '/payments' }
      ],
      Supervision: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Subcontractors', icon: Users, path: '/subcontractors' },
        { name: 'Site Management', icon: Building2, path: '/site-management' },
        { name: 'Payments', icon: DollarSign, path: '/payments' }
      ],
      Sales: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Apartments', icon: Home, path: '/apartments' },
        { name: 'Projects', icon: Building2, path: '/sales-projects' },
        { name: 'Customers', icon: Users, path: '/customers' },
        { name: 'Payments', icon: DollarSign, path: '/sales-payments' },
        { name: 'Reports', icon: BarChart3, path: '/sales-reports' }
      ],
      Funding: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Banks', icon: Building2, path: '/banks' },
        { name: 'Projects', icon: Building2, path: '/investment-projects' },
        { name: 'Investors', icon: Users, path: '/investors' }
      ]
    }

    return menuConfig[currentProfile] || menuConfig.General
  }

  const menuItems = getMenuItems()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Building2 className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Landmark</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <User className="w-4 h-4" />
                  <span className="font-medium">{currentProfile}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {(['General', 'Supervision', 'Sales', 'Funding'] as Profile[]).map((profile) => (
                      <button
                        key={profile}
                        onClick={() => {
                          setCurrentProfile(profile)
                          setShowProfileDropdown(false)
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                          currentProfile === profile ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        {profile}
                      </button>
                    ))}
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