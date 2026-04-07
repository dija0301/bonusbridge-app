import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate          = useNavigate()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase puts the session in the URL hash after a password reset link click
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) { setError(error.message); return }
    setDone(true)

    setTimeout(() => navigate('/login', { replace: true }), 3000)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
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
          {done ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="2 8 6 12 14 4"/></svg>
              </div>
              <h2 className="text-white font-semibold mb-2">Password updated</h2>
              <p className="text-slate-400 text-sm">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <h1 className="text-white text-xl font-semibold mb-1">Set new password</h1>
              <p className="text-slate-400 text-sm mb-7">Choose a strong password for your BonusBridge account.</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">New Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirm Password</label>
                  <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition" />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">{error}</div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition mt-1">
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
