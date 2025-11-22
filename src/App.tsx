import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginForm from './components/Auth/LoginForm'
import Layout from './components/Common/Layout'
import Dashboard from './components/Common/Dashboard'
import SubcontractorManagement from './components/Subcontractors/SubcontractorManagement'
import ProjectDetails from './components/Projects/ProjectDetails'
import SiteManagement from './components/SiteManagement'
import SalesProjects from './components/SalesProjectsEnhanced'
import CustomersManagement from './components/CustomersManagement'
import SalesReports from './components/Reports/SalesReports'
import BanksManagement from './components/Finance/banks/BanksManagement'
import InvestmentProjects from './components/Projects/InvestmentProjects'
import InvestorsManagement from './components/Finance/investors/InvestorsManagement'
import PaymentsManagement from './components/Payments/PaymentsManagement'
import ApartmentManagement from './components/ApartmentManagement'
import SalesPaymentsManagement from './components/Payments/SalesPaymentsManagement'
import SupervisionReports from './components/Reports/SupervisionReports'
import WorkLogs from './components/Subcontractors/WorkLogs'
import FundingPaymentsManagement from './components/Payments/FundingPaymentsManagement'
import GeneralPaymentsManagement from './components/Payments/GeneralPaymentsManagement'
import FundingOverview from './components/Finance/overview/FundingOverview'
import GeneralReports from './components/Reports/GeneralReports'
import AccountingInvoices from './components/Accounting/AccountingInvoices'
import AccountingPayments from './components/Accounting/AccountingPayments'
import AccountingSuppliers from './components/Accounting/AccountingSuppliers'
import AccountingCompanies from './components/Accounting/AccountingCompanies'
import AccountingCustomers from './components/Accounting/AccountingCustomers'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginForm />
  }

  return <Layout>{children}</Layout>
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
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectDetails />
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
          path="/investors"
          element={
            <ProtectedRoute>
              <InvestorsManagement />
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
          path="/supervision-reports"
          element={
            <ProtectedRoute>
              <SupervisionReports />
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
          path="/general-payments"
          element={
            <ProtectedRoute>
              <GeneralPaymentsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/funding-overview"
          element={
            <ProtectedRoute>
              <FundingOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/general-reports"
          element={
            <ProtectedRoute>
              <GeneralReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-invoices"
          element={
            <ProtectedRoute>
              <AccountingInvoices />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-payments"
          element={
            <ProtectedRoute>
              <AccountingPayments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-suppliers"
          element={
            <ProtectedRoute>
              <AccountingSuppliers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-companies"
          element={
            <ProtectedRoute>
              <AccountingCompanies />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-customers"
          element={
            <ProtectedRoute>
              <AccountingCustomers />
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App