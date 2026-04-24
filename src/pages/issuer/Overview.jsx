import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const recipientName = r => r ? [r.first_name, r.last_name].filter(Boolean).join(' ') || '—' : '—'

const BONUS_TYPE_LABELS = {
  signing_bonus:         'Signing',
  starting_bonus:        'Starting',
  relocation_bonus:      'Relocation',
  tuition_reimbursement: 'Tuition / CE',
  retention_bonus:       'Retention',
  performance_bonus:     'Performance',
  referral_bonus:        'Referral',
  custom:                'Custom',
}

const STATUS_STYLES = {
  active:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  draft:      'bg-slate-500/10 text-slate-400 border-slate-500/20',
  forgiven:   'bg-brand-500/10 text-brand-400 border-brand-500/20',
  terminated: 'bg-red-500/10 text-red-400 border-red-500/20',
  collected:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  cancelled:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

function StatCard({ label, value, sub, accent, icon }) {
  const color = { emerald: 'text-emerald-400', red: 'text-red-400', brand: 'text-brand-400' }[accent] ?? 'text-white'
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-semibold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, linkTo, linkLabel }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
      <h2 className="text-white font-medium">{title}</h2>
      {linkTo && (
        <Link to={linkTo} className="text-brand-400 hover:text-brand-300 text-sm font-medium transition">
          {linkLabel ?? 'View all →'}
        </Link>
      )}
    </div>
  )
}

export default function IssuerOverview() {
  const { profile }   = useAuth()
  const issuerId      = profile?.issuer_id
  const issuerName    = profile?.issuers?.name ?? 'Your Organization'

  const [agreements, setAgreements] = useState([])
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  useEffect(() => { if (issuerId) load() }, [issuerId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [agRes, recRes] = await Promise.all([
        supabase
          .from('agreements')
          .select('id, status, bonus_type, principal_amount, outstanding_balance, effective_date, projected_end_date, forgiveness_start_date, custom_terms, recipients(id, first_name, last_name, title)')
          .eq('issuer_id', issuerId)
          .order('created_at', { ascending: false }),
        supabase
          .from('recipients')
          .select('id, is_active')
          .eq('issuer_id', issuerId),
      ])
      if (agRes.error)  throw agRes.error
      if (recRes.error) throw recRes.error
      setAgreements(agRes.data)
      setRecipients(recRes.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Computed stats ─────────────────────────────────────
  const active       = agreements.filter(a => a.status === 'active')
  const terminated   = agreements.filter(a => a.status === 'terminated')
  const needsAttention = terminated.filter(a => (a.outstanding_balance ?? 0) > 0)

  const totalPortfolio   = agreements.reduce((s, a) => s + (a.principal_amount ?? 0), 0)
  const totalOutstanding = active.reduce((s, a) => s + (a.outstanding_balance ?? 0), 0)
  const activeRecipients = recipients.filter(r => r.is_active).length

  // Upcoming milestones — retention/performance with payment dates in next 90 days
  const today     = new Date()
  const in90Days  = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
  const upcoming  = []
  agreements.forEach(a => {
    if (a.bonus_type === 'retention_bonus' && a.custom_terms?.installments) {
      a.custom_terms.installments.forEach(inst => {
        if (inst.date) {
          const d = new Date(inst.date)
          if (d >= today && d <= in90Days) {
            upcoming.push({ agreement: a, date: inst.date, amount: inst.amount, label: 'Retention Payment' })
          }
        }
      })
    }
    if (a.bonus_type === 'referral_bonus' && a.custom_terms?.installments) {
      a.custom_terms.installments.forEach(inst => {
        if (inst.date) {
          const d = new Date(inst.date)
          if (d >= today && d <= in90Days) {
            upcoming.push({ agreement: a, date: inst.date, amount: inst.amount, label: 'Referral Payment' })
          }
        }
      })
    }
    if (a.bonus_type === 'performance_bonus' && a.custom_terms?.milestones) {
      a.custom_terms.milestones.forEach(m => {
        if (m.date) {
          const d = new Date(m.date)
          if (d >= today && d <= in90Days) {
            upcoming.push({ agreement: a, date: m.date, amount: m.amount, label: m.description || 'Performance Milestone' })
          }
        }
      })
    }
  })
  upcoming.sort((a, b) => new Date(a.date) - new Date(b.date))

  // Bonus type breakdown
  const typeBreakdown = Object.entries(
    agreements.reduce((acc, a) => {
      if (a.status !== 'active') return acc
      acc[a.bonus_type] = (acc[a.bonus_type] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const recent = agreements.slice(0, 6)

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <p className="text-slate-400 text-sm mb-1">{issuerName}</p>
        <h1 className="text-white text-2xl font-semibold">Overview</h1>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
          Failed to load data: {error}
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Portfolio"
          value={loading ? '—' : fmt(totalPortfolio)}
          sub="All agreement principals"
        />
        <StatCard
          label="Outstanding Balance"
          value={loading ? '—' : fmt(totalOutstanding)}
          sub={`Across ${active.length} active agreement${active.length !== 1 ? 's' : ''}`}
          accent="brand"
        />
        <StatCard
          label="Active Recipients"
          value={loading ? '—' : activeRecipients}
          sub={`${agreements.length} total agreements`}
          accent="emerald"
        />
        <StatCard
          label="Needs Attention"
          value={loading ? '—' : needsAttention.length}
          sub={needsAttention.length > 0 ? 'Terminated with balance' : 'All clear'}
          accent={needsAttention.length > 0 ? 'red' : null}
        />
      </div>

      {/* ── Two column: breakdown + upcoming ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

        {/* Active by type */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <SectionHeader title="Active Agreements by Type" />
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
          ) : typeBreakdown.length === 0 ? (
            <div className="px-6 py-10 text-slate-500 text-sm text-center">No active agreements yet</div>
          ) : (
            <div className="px-6 py-4 flex flex-col gap-3">
              {typeBreakdown.map(([type, count]) => {
                const pct = Math.round(count / active.length * 100)
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 text-sm">{BONUS_TYPE_LABELS[type] ?? type}</span>
                      <span className="text-slate-400 text-xs font-mono">{count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming milestones */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <SectionHeader title="Upcoming Milestones" sub="Next 90 days" />
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
          ) : upcoming.length === 0 ? (
            <div className="px-6 py-10 text-slate-500 text-sm text-center">No upcoming milestones in the next 90 days</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {upcoming.slice(0, 5).map((u, i) => (
                <div key={i} className="px-6 py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{recipientName(u.agreement.recipients)}</p>
                    <p className="text-slate-500 text-xs mt-0.5 truncate">{u.label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white text-sm font-mono">{u.amount ? fmt(u.amount) : '—'}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{fmtDate(u.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Needs attention ── */}
      {!loading && needsAttention.length > 0 && (
        <div className="bg-slate-900 border border-red-500/20 rounded-2xl overflow-hidden mb-6">
          <SectionHeader title="Needs Attention" linkTo="/issuer/agreements" linkLabel="View agreements →" />
          <div className="divide-y divide-slate-800/60">
            {needsAttention.map(a => (
              <div key={a.id} className="px-6 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-slate-200 text-sm font-medium">{recipientName(a.recipients)}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {BONUS_TYPE_LABELS[a.bonus_type]} · Terminated with outstanding balance
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-red-400 font-mono text-sm font-semibold">{fmt(a.outstanding_balance)}</p>
                  <p className="text-slate-500 text-xs mt-0.5">outstanding</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent agreements ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <SectionHeader title="Recent Agreements" linkTo="/issuer/agreements" linkLabel="View all →" />
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                  <th className="text-left px-6 py-3 font-medium">Recipient</th>
                  <th className="text-left px-6 py-3 font-medium">Type</th>
                  <th className="text-left px-6 py-3 font-medium">Principal</th>
                  <th className="text-left px-6 py-3 font-medium">Outstanding</th>
                  <th className="text-left px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recent.map(ag => (
                  <tr key={ag.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-3.5">
                      <p className="text-slate-200 font-medium">{recipientName(ag.recipients)}</p>
                      {ag.recipients?.title && <p className="text-slate-500 text-xs">{ag.recipients.title}</p>}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 text-xs">
                      {BONUS_TYPE_LABELS[ag.bonus_type] ?? ag.bonus_type}
                    </td>
                    <td className="px-6 py-3.5 text-slate-300 font-mono">{fmt(ag.principal_amount)}</td>
                    <td className="px-6 py-3.5 text-slate-300 font-mono">{fmt(ag.outstanding_balance)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLES[ag.status] ?? STATUS_STYLES.draft}`}>
                        {ag.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
