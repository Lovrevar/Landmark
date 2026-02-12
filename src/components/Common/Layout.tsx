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
  X,
  FolderKanban,
  CreditCard,
  Lock,
  AlertCircle,
  MapPin,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  CheckCircle
} from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentProfile, setCurrentProfile, logout, user } = useAuth()
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null)
  const navigate = useNavigate()

  const getMenuItems = () => {
    if (user?.role === 'Supervision') {
      return [
        { name: 'Site Management', icon: Building2, path: '/site-management' },
        { name: 'Work Logs', icon: ClipboardCheck, path: '/work-logs' },
        { name: 'Payments', icon: DollarSign, path: '/payments' },
        { name: 'Invoices', icon: FileText, path: '/invoices' }
      ]
    }

    const menuConfig = {
      General: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Projects', icon: FolderKanban, path: '/projects' },
        { name: 'Reports', icon: FileText, path: '/general-reports' }
      ],
      Supervision: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Site Management', icon: Building2, path: '/site-management' },
        { name: 'Subcontractors', icon: Users, path: '/subcontractors' },
        { name: 'Work Logs', icon: ClipboardCheck, path: '/work-logs' },
        { name: 'Payments', icon: DollarSign, path: '/payments' },
        { name: 'Invoices', icon: FileText, path: '/invoices' }
      ],
      Sales: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Apartments', icon: Home, path: '/apartments' },
        { name: 'Sales Projects', icon: Building2, path: '/sales-projects' },
        { name: 'Customers', icon: Users, path: '/customers' },
        { name: 'Payments', icon: DollarSign, path: '/sales-payments' },
        { name: 'Reports', icon: BarChart3, path: '/sales-reports' }
      ],
      Funding: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Funding Overview', icon: TrendingUp, path: '/funding-overview' },
        { name: 'Investors', icon: Building2, path: '/banks' },
        { name: 'Investments', icon: CreditCard, path: '/funding-credits' },
        { name: 'Projects', icon: Building2, path: '/investment-projects' },
        { name: 'Payments', icon: DollarSign, path: '/funding-payments' },
        { name: 'TIC', icon: Calculator, path: '/tic' }
      ],
      Cashflow: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Računi', icon: FileText, path: '/accounting-invoices' },
        { name: 'Plaćanja', icon: DollarSign, path: '/accounting-payments' },
        { name: 'Kalendar dospijeća', icon: Calendar, path: '/accounting-calendar' },
        { name: 'Dobavljači', icon: Users, path: '/accounting-suppliers' },
        { name: 'Office Dobavljači', icon: Building2, path: '/office-suppliers' },
        { name: 'Moje firme', icon: Building2, path: '/accounting-companies' },
        { name: 'Banke', icon: Building2, path: '/accounting-banks' },
        /*{ name: 'Krediti', icon: CreditCard, path: '/company-credits' },*/
        { name: 'Kupci', icon: Users, path: '/accounting-customers' },
        { name: 'Pozajmice i Prijenosi', icon: TrendingUp, path: '/accounting-loans' },
        { name: 'Stanje duga', icon: AlertCircle, path: '/debt-status' },
        { name: 'Odobrenja', icon: CheckCircle, path: '/accounting-approvals' }
      ],
      Retail: [
        { name: 'Dashboard', icon: BarChart3, path: '/' },
        { name: 'Projekti', icon: FolderKanban, path: '/retail-projects' },
        { name: 'Zemljišta', icon: MapPin, path: '/retail-land-plots' },
        { name: 'Kupci', icon: Users, path: '/retail-customers' },
        { name: 'Prodaje', icon: ShoppingCart, path: '/retail-sales-payments' },
        { name: 'Izvještaji', icon: FileText, path: '/retail-reports' }
      ]
    }

    return menuConfig[currentProfile] || menuConfig.General
  }

  const menuItems = getMenuItems()

  const handleProfileChange = (profile: Profile) => {
    if (profile === 'Cashflow') {
      setPendingProfile(profile)
      setShowPasswordModal(true)
      setShowProfileDropdown(false)
    } else {
      setCurrentProfile(profile)
      setShowProfileDropdown(false)
      navigate('/')
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (password === 'admin') {
      setCurrentProfile(pendingProfile!)
      setShowPasswordModal(false)
      setPassword('')
      setPasswordError('')
      setPendingProfile(null)
      navigate('/')
    } else {
      setPasswordError('Netočna šifra. Pokušajte ponovno.')
    }
  }

  const handlePasswordCancel = () => {
    setShowPasswordModal(false)
    setPassword('')
    setPasswordError('')
    setPendingProfile(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Building2 className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Cognilion</h1>
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
                      {(['General', 'Supervision', 'Sales', 'Funding', 'Cashflow', 'Retail'] as Profile[]).map((profile) => (
                        <button
                          key={profile}
                          onClick={() => handleProfileChange(profile)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between ${
                            currentProfile === profile ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                          }`}
                        >
                          <span>{profile}</span>
                          {profile === 'Cashflow' && <Lock className="w-3 h-3" />}
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
        <aside
          className={`
            bg-white shadow-sm border-r border-gray-200 min-h-screen
            transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'w-64' : 'w-16'}
            flex-shrink-0
          `}
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 flex justify-end">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                title={sidebarOpen ? 'Zatvori sidebar' : 'Otvori sidebar'}
              >
                {sidebarOpen ? (
                  <ChevronLeft className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>
            </div>
            <nav className="p-4 flex-1">
              <ul className="space-y-2">
                {menuItems.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.path}
                      className="flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors duration-200 group relative"
                      title={!sidebarOpen ? item.name : undefined}
                    >
                      <item.icon className={`w-5 h-5 flex-shrink-0 ${sidebarOpen ? 'mr-3' : ''}`} />
                      <span
                        className={`
                          whitespace-nowrap overflow-hidden transition-all duration-300
                          ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}
                        `}
                      >
                        {item.name}
                      </span>
                      {!sidebarOpen && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
                          {item.name}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-x-auto">
          {children}
        </main>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Cashflow Access</h2>
                <p className="text-sm text-gray-600">Unesite šifru za pristup</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Šifra
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordError('')
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Unesite šifru"
                  autoFocus
                />
              </div>

              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{passwordError}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Potvrdi
                </button>
                <button
                  type="button"
                  onClick={handlePasswordCancel}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                >
                  Odustani
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Layout