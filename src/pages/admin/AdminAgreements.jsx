import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const fmt     = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const BONUS_TYPE_LABELS = {
  signing_bonus: 'Signing', starting_bonus: 'Starting',
  retention_bonus: 'Retention', performance_bonus: 'Performance', custom: 'Custom',
}

const STATUS_STYLES = {
  draft:      'bg-slate-500/10 text-slate-400 border-slate-500/20',
  onboarding: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  active:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  forgiven:   'bg-brand-500/10 text-brand-400 border-brand-500/20',
  terminated: 'bg-red-500/10 text-red-400 border-red-500/20',
  collected:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

export default function AdminAgreements() {
  const [agreements, setAgreements] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')
  const [sortCol, setSortCol]       = useState('created_at')
  const [sortDir, setSortDir]       = useState('desc')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('agreements')
      .select('*, recipients(first_name, last_name), issuers(name)')
      .order('created_at', { ascending: false })
    setAgreements(data ?? [])
    setLoading(false)
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortIcon(col) {
    if (sortCol !== col) return <span className="text-slate-600 ml-1">↕</span>
    return <span className="text-brand-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const filtered = agreements
    .filter(a => {
      const q = search.toLowerCase()
      const name = `${a.recipients?.first_name ?? ''} ${a.recipients?.last_name ?? ''}`.toLowerCase()
      const org  = a.issuers?.name?.toLowerCase() ?? ''
      const matchSearch = !q || name.includes(q) || org.includes(q) || a.agreement_number?.toLowerCase().includes(q)
      const matchFilter = filter === 'all' ? true : a.status === filter
      return matchSearch && matchFilter
    })
    .sort((a, b) => {
      let av = a[sortCol] ?? '', bv = b[sortCol] ?? ''
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })

  const totalPortfolio   = filtered.reduce((s, a) => s + (parseFloat(a.principal_amount) || 0), 0)
  const totalOutstanding = filtered.reduce((s, a) => s + (parseFloat(a.outstanding_balance) || 0), 0)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">All Agreements</h1>
          <p className="text-slate-400 text-sm mt-1">
            {filtered.length} agreements · {fmt(totalPortfolio)} portfolio · {fmt(totalOutstanding)} outstanding
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by recipient, client, or agreement number…"
          className="flex-1 min-w-48 bg-slate-900 border border-slate-800 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition" />
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {['all','active','draft','onboarding','terminated'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition capitalize ${filter === f ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('issuer_id')}>Client{sortIcon('issuer_id')}</th>
                  <th className="text-left px-5 py-3 font-medium">Recipient</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('principal_amount')}>Principal{sortIcon('principal_amount')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('outstanding_balance')}>Outstanding{sortIcon('outstanding_balance')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('effective_date')}>Effective{sortIcon('effective_date')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('status')}>Status{sortIcon('status')}</th>
                  <th className="text-left px-5 py-3 font-medium">Acknowledged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5 text-slate-300 text-xs">{a.issuers?.name ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-200 font-medium">
                        {a.recipients ? `${a.recipients.first_name} ${a.recipients.last_name}` : '—'}
                      </p>
                      {a.agreement_number && <p className="text-slate-500 text-xs">No. {a.agreement_number}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{BONUS_TYPE_LABELS[a.bonus_type] ?? a.bonus_type}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono">{fmt(a.principal_amount)}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono">{fmt(a.outstanding_balance)}</td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{fmtDate(a.effective_date)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLES[a.status] ?? STATUS_STYLES.draft}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {a.acknowledged_at
                        ? <span className="text-emerald-400 text-xs">✓ {fmtDate(a.acknowledged_at.split('T')[0])}</span>
                        : <span className="text-slate-600 text-xs italic">Pending</span>
                      }
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
