import React, { lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider } from './contexts/ThemeContext'
import LoginForm from './components/Auth/LoginForm'
import Layout from './components/Common/Layout'
import Dashboard from './components/Common/Dashboard'
import PageFallback from './components/Common/PageFallback'
import AiChatProvider from './components/AiChat/AiChatProvider'

const SubcontractorManagement = lazy(() => import('./components/Supervision/Subcontractors/index'))
const ProjectDetailsEnhanced = lazy(() => import('./components/General/Projects/ProjectDetailsEnhanced'))
const ProjectsManagement = lazy(() => import('./components/General/Projects/index'))
const SiteManagement = lazy(() => import('./components/Supervision/SiteManagement/index'))
const SalesProjects = lazy(() => import('./components/Sales/SalesProjects/index'))
const CustomersManagement = lazy(() => import('./components/Sales/Customers/index'))
const SalesReports = lazy(() => import('./components/Reports/SalesReports'))
const BanksManagement = lazy(() => import('./components/Funding/Investors/index'))
const InvestmentProjects = lazy(() => import('./components/Funding/Projects/index'))
const PaymentsManagement = lazy(() => import('./components/Supervision/Payments/index'))
const InvoicesManagement = lazy(() => import('./components/Supervision/Invoices/index'))
const ApartmentManagement = lazy(() => import('./components/Sales/Apartments/index'))
const SalesPaymentsManagement = lazy(() => import('./components/Sales/Payments/index'))
const RetailSalesPaymentsManagement = lazy(() => import('./components/Retail/Sales/index'))
const WorkLogs = lazy(() => import('./components/Supervision/WorkLogs/index'))
const FundingPaymentsManagement = lazy(() => import('./components/Funding/Payments/index'))
const GeneralReports = lazy(() => import('./components/Reports/GeneralReports'))
const DocumentsPage = lazy(() => import('./components/Documents/index'))
const AccountingInvoices = lazy(() => import('./components/Cashflow/Invoices/index'))
const AccountingPayments = lazy(() => import('./components/Cashflow/Payments/index'))
const AccountingSuppliers = lazy(() => import('./components/Cashflow/Suppliers/index'))
const OfficeSuppliers = lazy(() => import('./components/Cashflow/OfficeSuppliers/index'))
const AccountingCompanies = lazy(() => import('./components/Cashflow/Companies/index'))
const AccountingBanks = lazy(() => import('./components/Cashflow/Banks/index'))
const AccountingCustomers = lazy(() => import('./components/Cashflow/Customers/index'))
const AccountingCalendar = lazy(() => import('./components/Cashflow/Calendar/index'))
const AccountingLoans = lazy(() => import('./components/Cashflow/Loans/index'))
const DebtStatus = lazy(() => import('./components/Cashflow/DebtStatus/index'))
const AccountingApprovals = lazy(() => import('./components/Cashflow/Approvals/index'))
const RetailLandPlots = lazy(() => import('./components/Retail/LandPlots/index'))
const RetailCustomers = lazy(() => import('./components/Retail/Customers/index'))
const RetailSales = lazy(() => import('./components/Retail/Sales/RetailSales'))
const RetailReports = lazy(() => import('./components/Reports/RetailReports'))
const RetailProjects = lazy(() => import('./components/Retail/Projects/index'))
const RetailInvoicesManagement = lazy(() => import('./components/Retail/Invoices/index'))
const TICManagement = lazy(() => import('./components/Funding/TIC/index'))
const CreditsManagement = lazy(() => import('./components/Funding/Investments/index'))
const BudgetControl = lazy(() => import('./components/General/BudgetControl/index'))
const ActivityLog = lazy(() => import('./components/General/ActivityLog/index'))
const ChatPage = lazy(() => import('./components/Chat'))
const TasksPage = lazy(() => import('./components/Tasks'))
const CalendarPage = lazy(() => import('./components/Calendar'))

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <PageFallback />
  }

  if (!isAuthenticated) {
    return <LoginForm />
  }

  return <Layout>{children}</Layout>
}

// Guards Cashflow routes. The role check is the real access control (mirrored
// by RLS policies at the database level — see migration
// 20260526084700_tighten_cashflow_rls.sql). The sessionStorage unlock is a UX
// speedbump for screen-shares, NOT a security boundary — the password ships in
// the JS bundle via VITE_CASHFLOW_PASSWORD.
const CashflowRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const unlocked = sessionStorage.getItem('cashflow_unlocked') === 'true'
  const roleAllowed = user?.role === 'Director' || user?.role === 'Accounting'
  if (!unlocked || !roleAllowed) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

// Director-only routes. RLS prevents non-Director users from reading the
// underlying portfolio-wide data; this guard prevents the confusing empty-PDF
// experience that would otherwise result.
const DirectorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  if (user?.role !== 'Director') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function AppContent() {
  const { user } = useAuth()

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              {user?.role === 'Supervision' ? <Navigate to="/site-management" replace /> : <Dashboard />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/budget-control"
          element={
            <ProtectedRoute>
              <BudgetControl />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectDetailsEnhanced />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subcontractors"
          element={
            <ProtectedRoute>
              <SubcontractorManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/site-management"
          element={
            <ProtectedRoute>
              <SiteManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-projects"
          element={
            <ProtectedRoute>
              <SalesProjects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <CustomersManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-reports"
          element={
            <ProtectedRoute>
              <SalesReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/banks"
          element={
            <ProtectedRoute>
              <BanksManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/investment-projects"
          element={
            <ProtectedRoute>
              <InvestmentProjects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <PaymentsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <ProtectedRoute>
              <InvoicesManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/apartments"
          element={
            <ProtectedRoute>
              <ApartmentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-payments"
          element={
            <ProtectedRoute>
              <SalesPaymentsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/work-logs"
          element={
            <ProtectedRoute>
              <WorkLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/funding-payments"
          element={
            <ProtectedRoute>
              <FundingPaymentsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tic"
          element={
            <ProtectedRoute>
              <TICManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/funding-credits"
          element={
            <ProtectedRoute>
              <CreditsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/general-reports"
          element={
            <ProtectedRoute>
              <DirectorRoute><GeneralReports /></DirectorRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-invoices"
          element={
            <ProtectedRoute>
              <CashflowRoute><AccountingInvoices /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-payments"
          element={
            <ProtectedRoute>
              <CashflowRoute><AccountingPayments /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-suppliers"
          element={
            <ProtectedRoute>
              <CashflowRoute><AccountingSuppliers /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/office-suppliers"
          element={
            <ProtectedRoute>
              <CashflowRoute><OfficeSuppliers /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-companies"
          element={
            <ProtectedRoute>
              <CashflowRoute><AccountingCompanies /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-banks"
          element={
            <ProtectedRoute>
              <CashflowRoute><AccountingBanks /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-customers"
          element={
            <ProtectedRoute>
              <CashflowRoute><AccountingCustomers /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-calendar"
          element={
            <ProtectedRoute>
              <CashflowRoute><AccountingCalendar /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-loans"
          element={
            <ProtectedRoute>
              <CashflowRoute><AccountingLoans /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/debt-status"
          element={
            <ProtectedRoute>
              <CashflowRoute><DebtStatus /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-approvals"
          element={
            <ProtectedRoute>
              <CashflowRoute><AccountingApprovals /></CashflowRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/retail-projects"
          element={
            <ProtectedRoute>
              <RetailProjects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/retail-land-plots"
          element={
            <ProtectedRoute>
              <RetailLandPlots />
            </ProtectedRoute>
          }
        />
        <Route
          path="/retail-customers"
          element={
            <ProtectedRoute>
              <RetailCustomers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/retail-sales"
          element={
            <ProtectedRoute>
              <RetailSales />
            </ProtectedRoute>
          }
        />
        <Route
          path="/retail-sales-payments"
          element={
            <ProtectedRoute>
              <RetailSalesPaymentsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/retail-invoices"
          element={
            <ProtectedRoute>
              <RetailInvoicesManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/retail-reports"
          element={
            <ProtectedRoute>
              <RetailReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity-log"
          element={
            <ProtectedRoute>
              <ActivityLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <TasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <DocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          {/* Step 5.5 insertion — provider mounted early to unblock 5.4a verification */}
          <AiChatProvider>
            <AppContent />
          </AiChatProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
