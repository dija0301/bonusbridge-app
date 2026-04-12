import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-2xl font-semibold font-mono">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [issuersRes, agreementsRes, recipientsRes] = await Promise.all([
      supabase.from('issuers').select('id, name, plan_tier, is_active, onboarded_at'),
      supabase.from('agreements').select('id, status, principal_amount, outstanding_balance, bonus_type, issuer_id'),
      supabase.from('recipients').select('id, is_active, last_login_at, onboarding_complete'),
    ])

    const issuers    = issuersRes.data ?? []
    const agreements = agreementsRes.data ?? []
    const recipients = recipientsRes.data ?? []

    setStats({
      totalClients:       issuers.length,
      activeClients:      issuers.filter(i => i.is_active).length,
      totalAgreements:    agreements.length,
      activeAgreements:   agreements.filter(a => a.status === 'active').length,
      totalPortfolio:     agreements.reduce((s, a) => s + (parseFloat(a.principal_amount) || 0), 0),
      totalOutstanding:   agreements.filter(a => a.status === 'active').reduce((s, a) => s + (parseFloat(a.outstanding_balance) || 0), 0),
      totalRecipients:    recipients.length,
      activeRecipients:   recipients.filter(r => r.is_active).length,
      onboardedRecipients: recipients.filter(r => r.onboarding_complete).length,
      issuers,
    })
    setLoading(false)
  }

  const PLAN_STYLES = {
    manage:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
    notify:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
    execute: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">BonusBridge platform overview</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Clients"      value={stats.totalClients}     sub={`${stats.activeClients} active`} />
            <StatCard label="Total Agreements"   value={stats.totalAgreements}  sub={`${stats.activeAgreements} active`} />
            <StatCard label="Total Portfolio"    value={fmt(stats.totalPortfolio)} sub="All agreement principals" />
            <StatCard label="Total Outstanding"  value={fmt(stats.totalOutstanding)} sub="Active agreements" />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard label="Total Recipients"    value={stats.totalRecipients}    sub={`${stats.activeRecipients} active`} />
            <StatCard label="Onboarded"           value={stats.onboardedRecipients} sub="Completed onboarding" />
            <StatCard label="Pending Onboarding"  value={stats.activeRecipients - stats.onboardedRecipients} sub="Have not completed onboarding" />
          </div>

          {/* Client list */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-medium">All Clients</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                  <th className="text-left px-6 py-3 font-medium">Organization</th>
                  <th className="text-left px-6 py-3 font-medium">Plan</th>
                  <th className="text-left px-6 py-3 font-medium">Onboarded</th>
                  <th className="text-left px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats.issuers.map(i => (
                  <tr key={i.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-3.5 text-slate-200 font-medium">{i.name}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${PLAN_STYLES[i.plan_tier] ?? PLAN_STYLES.manage}`}>
                        {i.plan_tier ?? 'manage'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 text-xs">
                      {i.onboarded_at ? new Date(i.onboarded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${i.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {i.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
