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

          {/* Admin portal — placeholder */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<div className="p-8 text-white">Admin dashboard — coming soon</div>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  )
}
