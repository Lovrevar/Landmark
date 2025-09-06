import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginForm from './components/LoginForm'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import TodoList from './components/TodoList'
import Calendar from './components/Calendar'
import TasksManagement from './components/TasksManagement'
import SubcontractorManagement from './components/SubcontractorManagement'
import ProjectDetails from './components/ProjectDetails'
import SiteManagement from './components/SiteManagement'
import SalesProjects from './components/SalesProjects'
import CustomersManagement from './components/CustomersManagement'
import SalesReports from './components/SalesReports'
import BanksManagement from './components/BanksManagement'
import InvestmentProjects from './components/InvestmentProjects'
import InvestorsManagement from './components/InvestorsManagement'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()

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

  if (!user) {
    return <LoginForm />
  }

  return <Layout>{children}</Layout>
}

function AppContent() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/todos"
          element={
            <ProtectedRoute>
              <TodoList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <TasksManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Calendar />
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