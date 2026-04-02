import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const recipientName = (r) =>
  r ? [r.first_name, r.last_name].filter(Boolean).join(' ') || '—' : '—'

const STATUS_STYLES = {
  active:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  draft:      'bg-slate-500/10 text-slate-400 border-slate-500/20',
  forgiven:   'bg-brand-500/10 text-brand-400 border-brand-500/20',
  in_default: 'bg-red-500/10 text-red-400 border-red-500/20',
  collected:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
  cancelled:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export default function IssuerOverview() {
  const { profile } = useAuth()
  const issuerId = profile?.issuer_id

  const [stats, setStats]     = useState(null)
  const [recent, setRecent]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!issuerId) return
    load()
  }, [issuerId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data: agreements, error: agErr } = await supabase
        .from('agreements')
        .select(`
          id,
          status,
          collections_status,
          principal_amount,
          outstanding_balance,
          effective_date,
          projected_end_date,
          bonus_type,
          recipients (
            id,
            first_name,
            last_name,
            title,
            department
          )
        `)
        .eq('issuer_id', issuerId)
        .order('created_at', { ascending: false })

      if (agErr) throw agErr

      const total            = agreements.length
      const active           = agreements.filter(a => a.status === 'active').length
      const inDefault        = agreements.filter(a => a.status === 'in_default').length
      const totalOutstanding = agreements.reduce((s, a) => s + (a.outstanding_balance ?? 0), 0)
      const totalPrincipal   = agreements.reduce((s, a) => s + (a.principal_amount ?? 0), 0)

      setStats({ total, active, inDefault, totalOutstanding, totalPrincipal })
      setRecent(agreements.slice(0, 8))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const issuerName = profile?.issuers?.name ?? 'Your Organization'

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-slate-400 text-sm mb-1">{issuerName}</p>
        <h1 className="text-white text-2xl font-semibold">Overview</h1>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
          Failed to load data: {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Agreements"   value={loading ? '—' : stats?.total ?? 0} />
        <StatCard label="Active"             value={loading ? '—' : stats?.active ?? 0} accent="emerald" />
        <StatCard label="Outstanding Balance" value={loading ? '—' : fmt(stats?.totalOutstanding)} />
        <StatCard label="In Default"         value={loading ? '—' : stats?.inDefault ?? 0} accent={stats?.inDefault > 0 ? 'red' : null} />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-medium">Recent Agreements</h2>
          <Link to="/issuer/agreements" className="text-brand-400 hover:text-brand-300 text-sm font-medium transition">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <p className="text-sm">No agreements yet.</p>
            <Link to="/issuer/agreements" className="text-brand-400 hover:text-brand-300 text-sm mt-2">
              Create your first agreement →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                <th className="text-left px-6 py-3 font-medium">Recipient</th>
                <th className="text-left px-6 py-3 font-medium">Type</th>
                <th className="text-left px-6 py-3 font-medium">Principal</th>
                <th className="text-left px-6 py-3 font-medium">Outstanding</th>
                <th className="text-left px-6 py-3 font-medium">Effective Date</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recent.map((ag) => (
                <tr key={ag.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-6 py-3.5">
                    <p className="text-slate-200 font-medium">{recipientName(ag.recipients)}</p>
                    {ag.recipients?.title && (
                      <p className="text-slate-500 text-xs">{ag.recipients.title}</p>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-slate-400 text-xs capitalize">
                    {(ag.bonus_type ?? '').replace(/_/g, ' ')}
                  </td>
                  <td className="px-6 py-3.5 text-slate-300 font-mono">{fmt(ag.principal_amount)}</td>
                  <td className="px-6 py-3.5 text-slate-300 font-mono">{fmt(ag.outstanding_balance)}</td>
                  <td className="px-6 py-3.5 text-slate-400">{fmtDate(ag.effective_date)}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLES[ag.status] ?? STATUS_STYLES.pending}`}>
                      {(ag.status ?? 'pending').replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  const accentColor = { emerald: 'text-emerald-400', red: 'text-red-400' }[accent] ?? 'text-white'
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold font-mono ${accentColor}`}>{value}</p>
    </div>
  )
}
