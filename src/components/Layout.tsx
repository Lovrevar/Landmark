import React, { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  Building2, 
  LogOut, 
  BarChart3, 
  Calculator, 
  Home, 
  Users, 
  CheckSquare,
  Calendar
} from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth()

  const getMenuItems = () => {
    const commonItems = [
      { name: 'Dashboard', icon: BarChart3, path: '/' },
      { name: 'My Tasks', icon: CheckSquare, path: '/todos' },
      { name: 'Calendar', icon: Calendar, path: '/calendar' }
    ]

    const roleSpecificItems = {
      Director: [
        { name: 'Projects', icon: Building2, path: '/projects' },
        { name: 'All Tasks', icon: CheckSquare, path: '/tasks' }
      ],
      Accounting: [
        { name: 'Invoices', icon: Calculator, path: '/invoices' },
        { name: 'Projects', icon: Building2, path: '/projects' }
      ],
      Sales: [
        { name: 'Apartments', icon: Home, path: '/apartments' },
        { name: 'Projects', icon: Building2, path: '/projects' }
      ],
      Supervision: [
        { name: 'Subcontractors', icon: Users, path: '/subcontractors' },
        { name: 'Site Management', icon: Building2, path: '/site-management' }
      ]
    }

    return [...commonItems, ...(roleSpecificItems[user?.role as keyof typeof roleSpecificItems] || [])]
  }

  const menuItems = getMenuItems()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Building2 className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">ConstructCorp</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {user?.username} ({user?.role})
              </span>
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