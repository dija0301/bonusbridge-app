import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn }    = useAuth()
  const navigate      = useNavigate()
  const location      = useLocation()

  // Detect role from query param
  const params        = new URLSearchParams(location.search)
  const roleHint      = params.get('role') // 'recipient' or null

  const [mode, setMode]       = useState('login')   // 'login' | 'forgot' | 'forgot_sent'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState(null)
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

    setTimeout(() => {
      if (roleHint === 'recipient') {
        navigate('/recipient', { replace: true })
      } else {
        navigate('/issuer', { replace: true })
      }
    }, 100)
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!email) { setError('Please enter your email address.'); return }
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (error) { setError(error.message); return }
    setMode('forgot_sent')
  }

  const isRecipient = roleHint === 'recipient'

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <svg width="44" height="28" viewBox="0 0 80 44" fill="none">
            <line x1="4" y1="40" x2="76" y2="40" stroke="#818cf8" strokeWidth="5" strokeLinecap="round"/>
            <line x1="4" y1="40" x2="4" y2="24" stroke="#818cf8" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="40" y1="40" x2="40" y2="24" stroke="#818cf8" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="76" y1="40" x2="76" y2="24" stroke="#818cf8" strokeWidth="3.5" strokeLinecap="round"/>
            <path d="M4 24 A18 10 0 0 1 40 24" stroke="#818cf8" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            <path d="M40 24 A18 10 0 0 1 76 24" stroke="#818cf8" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            <line x1="16" y1="14.6" x2="16" y2="40" stroke="#c7d2fe" strokeWidth="1.3" strokeLinecap="round" opacity=".6"/>
            <line x1="28" y1="14.6" x2="28" y2="40" stroke="#c7d2fe" strokeWidth="1.3" strokeLinecap="round" opacity=".6"/>
            <line x1="52" y1="14.6" x2="52" y2="40" stroke="#c7d2fe" strokeWidth="1.3" strokeLinecap="round" opacity=".6"/>
            <line x1="64" y1="14.6" x2="64" y2="40" stroke="#c7d2fe" strokeWidth="1.3" strokeLinecap="round" opacity=".6"/>
          </svg>
          <span className="text-white font-semibold text-lg tracking-tight">BonusBridge</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">

          {/* Role badge */}
          {isRecipient && (
            <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="5" r="2.5"/><path d="M2 13c0-2.8 2.7-5 6-5s6 2.2 6 5"/></svg>
              <p className="text-emerald-400 text-xs font-medium">Recipient Portal</p>
            </div>
          )}

          {mode === 'login' && (
            <>
              <h1 className="text-white text-xl font-semibold mb-1">Sign in</h1>
              <p className="text-slate-400 text-sm mb-7">
                {isRecipient ? 'Access your bonus agreement portal' : 'Access your BonusBridge dashboard'}
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
                  <input type="email" autoComplete="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                    placeholder="you@example.com" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-slate-300 text-sm font-medium">Password</label>
                    <button type="button" onClick={() => { setMode('forgot'); setError(null) }}
                      className="text-brand-400 hover:text-brand-300 text-xs font-medium transition">
                      Forgot password?
                    </button>
                  </div>
                  <input type="password" autoComplete="current-password" required value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                    placeholder="••••••••" />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">{error}</div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition mt-1">
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              {isRecipient && (
                <p className="text-slate-500 text-xs text-center mt-5 leading-relaxed">
                  First time? Use the link in your invitation email to access your portal. Contact your HR team if you haven't received one.
                </p>
              )}
            </>
          )}

          {mode === 'forgot' && (
            <>
              <h1 className="text-white text-xl font-semibold mb-1">Reset password</h1>
              <p className="text-slate-400 text-sm mb-7">Enter your email and we'll send you a reset link.</p>

              <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
                  <input type="email" autoComplete="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                    placeholder="you@example.com" />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">{error}</div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition">
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>

                <button type="button" onClick={() => { setMode('login'); setError(null) }}
                  className="text-slate-400 hover:text-white text-sm text-center transition">
                  Back to sign in
                </button>
              </form>
            </>
          )}

          {mode === 'forgot_sent' && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-brand-500/15 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-brand-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M1 5l7 5 7-5"/></svg>
              </div>
              <h2 className="text-white font-semibold mb-2">Check your email</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                We sent a password reset link to <span className="text-white">{email}</span>. Check your inbox and follow the link to reset your password.
              </p>
              <button onClick={() => { setMode('login'); setError(null) }}
                className="text-brand-400 hover:text-brand-300 text-sm font-medium transition">
                Back to sign in
              </button>
            </div>
          )}
        </div>

        {!isRecipient && (
          <p className="text-center text-slate-500 text-xs mt-6">
            Don't have an account? Contact your administrator.
          </p>
        )}
      </div>
    </div>
  )
}
