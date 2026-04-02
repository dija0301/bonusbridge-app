import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children, allowedRoles }) {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm font-mono">Loading…</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to the right home for the actual role
    const roleHome = { issuer: '/issuer', recipient: '/recipient', admin: '/admin' }
    return <Navigate to={roleHome[role] ?? '/login'} replace />
  }

  return children
}
