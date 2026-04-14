import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'

import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import AppShell from './pages/AppShell'
import IssuerOverview from './pages/issuer/Overview'
import Agreements from './pages/issuer/Agreements'
import Recipients from './pages/issuer/Recipients'
import Collections from './pages/issuer/Collections'
// Collections page is now Departure Response
import Settings from './pages/issuer/Settings'
import Reports from './pages/issuer/Reports'
import Import from './pages/issuer/Import'
import AdminShell from './pages/admin/AdminShell'
import AdminDashboard from './pages/admin/Dashboard'
import AdminClients from './pages/admin/Clients'
import AdminAgreements from './pages/admin/AdminAgreements'
import AdminRecipients from './pages/admin/AdminRecipients'
import RecipientPortal from './pages/recipient/Portal'

function RoleRedirect() {
  const { role, loading } = useAuth()
  if (loading) return null
  const dest = {
    issuer_admin: '/issuer',
    issuer_user:  '/issuer',
    recipient:    '/recipient',
  }[role] ?? '/login'
  return <Navigate to={dest} replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Root → role-based redirect */}
          <Route path="/" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

          {/* Issuer portal */}
          <Route
            path="/issuer"
            element={
              <ProtectedRoute allowedRoles={['issuer_admin', 'issuer_user']}>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<IssuerOverview />} />
            <Route path="agreements"  element={<Agreements />} />
            <Route path="recipients"  element={<Recipients />} />
            <Route path="collections" element={<Collections />} />
            <Route path="import"      element={<Import />} />
            <Route path="reports"     element={<Reports />} />
            <Route path="settings"    element={<Settings />} />
          </Route>

          {/* Recipient portal */}
          <Route
            path="/recipient"
            element={
              <ProtectedRoute allowedRoles={['recipient']}>
                <RecipientPortal />
              </ProtectedRoute>
            }
          />

          {/* Admin portal */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="clients"    element={<AdminClients />} />
            <Route path="agreements" element={<AdminAgreements />} />
            <Route path="recipients" element={<AdminRecipients />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  )
}
