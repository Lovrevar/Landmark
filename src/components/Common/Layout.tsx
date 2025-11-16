import React, { ReactNode, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, Profile } from '../../contexts/AuthContext'
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
  User,
  ClipboardCheck,
  TrendingUp,
  FileText,
  Menu,
  X
} from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentProfile, setCurrentProfile, logout, user } = useAuth()
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const getMenuItems = () => {
    if (user?.role === 'Supervision') {
      return [
        { name: 'Site Management', icon: Building2, path: '/site-management' },
        { name: 'Work Logs', icon: ClipboardCheck, path: '/work-logs' }
      ]
    }

    const menuConfig = {
      General: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Reports', icon: FileText, path: '/general-reports' },
        { name: 'General Payments', icon: DollarSign, path: '/general-payments' }
      ],
      Supervision: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Site Management', icon: Building2, path: '/site-management' },
        { name: 'Subcontractors', icon: Users, path: '/subcontractors' },
        { name: 'Work Logs', icon: ClipboardCheck, path: '/work-logs' },
        { name: 'Reports', icon: FileText, path: '/supervision-reports' }
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
        { name: 'Funding Overview', icon: TrendingUp, path: '/funding-overview' },
        { name: 'Banks', icon: Building2, path: '/banks' },
        { name: 'Projects', icon: Building2, path: '/investment-projects' },
        { name: 'Investors', icon: Users, path: '/investors' },
        { name: 'Payments', icon: DollarSign, path: '/funding-payments' }
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
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden mr-3 p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Building2 className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Landmark</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user?.role !== 'Supervision' && (
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
                            navigate('/')
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
              )}
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

      <div className="flex relative">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50
            w-64 bg-white shadow-sm border-r border-gray-200
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            lg:min-h-screen
          `}
        >
          <div className="flex justify-between items-center p-4 border-b border-gray-200 lg:hidden">
            <span className="font-semibold text-gray-900">Menu</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors duration-200"
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="flex-1 p-6 w-full lg:w-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout