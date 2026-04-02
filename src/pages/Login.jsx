import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, role } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Role-based redirect happens via AuthContext → App router
    // Give state a tick to settle
    setTimeout(() => {
      const stored = localStorage.getItem('bb_role_redirect')
      if (stored) {
        localStorage.removeItem('bb_role_redirect')
        navigate(stored, { replace: true })
      } else {
        navigate('/issuer', { replace: true })
      }
    }, 100)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo mark */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            {/* B rotated 90° — the BonusBridge logomark */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(90, 8, 8)">
                <path d="M4 3h5.5a2.5 2.5 0 0 1 0 5H4V3z" fill="white"/>
                <path d="M4 8h6a2.5 2.5 0 0 1 0 5H4V8z" fill="white" fillOpacity="0.7"/>
              </g>
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">BonusBridge</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-white text-xl font-semibold mb-1">Sign in</h1>
          <p className="text-slate-400 text-sm mb-7">Access your BonusBridge dashboard</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                placeholder="you@organization.com"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition mt-1"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Don't have an account? Contact your administrator.
        </p>
      </div>
    </div>
  )
}
