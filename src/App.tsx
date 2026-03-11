import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginForm from './components/Auth/LoginForm'
import Layout from './components/Common/Layout'
import Dashboard from './components/Common/Dashboard'
import SubcontractorManagement from './components/Supervision/Subcontractors/index'
import ProjectDetailsEnhanced from './components/General/Projects/ProjectDetailsEnhanced'
import ProjectsManagement from './components/General/Projects/index'
import SiteManagement from './components/Supervision/SiteManagement/index'
import SalesProjects from './components/Sales/SalesProjects/index'
import CustomersManagement from './components/Sales/Customers/index'
import SalesReports from './components/Reports/SalesReports'
import BanksManagement from './components/Funding/Investors/index'
import InvestmentProjects from './components/Funding/Projects/index'
import PaymentsManagement from './components/Supervision/Payments/index'
import InvoicesManagement from './components/Supervision/Invoices/index'
import ApartmentManagement from './components/Sales/Apartments/index'
import SalesPaymentsManagement from './components/Sales/Payments/index'
import RetailSalesPaymentsManagement from './components/Retail/Sales/index'
import WorkLogs from './components/Supervision/WorkLogs/index'
import FundingPaymentsManagement from './components/Funding/Payments/index'
import GeneralReports from './components/Reports/GeneralReports'
import AccountingInvoices from './components/Cashflow/Invoices/index'
import AccountingPayments from './components/Cashflow/Payments/index'
import AccountingSuppliers from './components/Cashflow/Suppliers/index'
import OfficeSuppliers from './components/Cashflow/OfficeSuppliers/index'
import AccountingCompanies from './components/Cashflow/Companies/index'
import AccountingBanks from './components/Cashflow/Banks/index'
import AccountingCustomers from './components/Cashflow/Customers/index'
import AccountingCalendar from './components/Cashflow/Calendar/index'
import AccountingLoans from './components/Cashflow/Loans/index'
import DebtStatus from './components/Cashflow/DebtStatus/index'
import AccountingApprovals from './components/Cashflow/Approvals/index'
import RetailLandPlots from './components/Retail/LandPlots/index'
import RetailCustomers from './components/Retail/Customers/index'
import RetailSales from './components/Retail/Sales/RetailSales'
import RetailReports from './components/Reports/RetailReports'
import RetailProjects from './components/Retail/Projects/index'
import RetailInvoicesManagement from './components/Retail/Invoices/index'
import TICManagement from './components/Funding/TIC/index'
import CreditsManagement from './components/Funding/Investments/index'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

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
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsManagement />
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
          path="/office-suppliers"
          element={
            <ProtectedRoute>
              <OfficeSuppliers />
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
          path="/accounting-banks"
          element={
            <ProtectedRoute>
              <AccountingBanks />
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
        <Route
          path="/accounting-calendar"
          element={
            <ProtectedRoute>
              <AccountingCalendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-loans"
          element={
            <ProtectedRoute>
              <AccountingLoans />
            </ProtectedRoute>
          }
        />
        <Route
          path="/debt-status"
          element={
            <ProtectedRoute>
              <DebtStatus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting-approvals"
          element={
            <ProtectedRoute>
              <AccountingApprovals />
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