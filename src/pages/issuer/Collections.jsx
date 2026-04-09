import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const fmt     = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const BONUS_TYPE_LABELS = {
  signing_bonus:     'Signing Bonus',
  starting_bonus:    'Starting Bonus',
  retention_bonus:   'Retention Bonus',
  performance_bonus: 'Performance Bonus',
  custom:            'Custom',
}

const STATUS_STYLES = {
  terminated: 'bg-red-500/10 text-red-400 border-red-500/20',
  collected:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  cancelled:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

function DownloadIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M2 12v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1"/></svg>
}

function SortIcon({ dir }) {
  if (!dir) return <span className="text-slate-600 ml-1">↕</span>
  return <span className="text-brand-400 ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

function exportCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = row[h] ?? ''
      return typeof val === 'string' && (val.includes(',') || val.includes('"'))
        ? `"${val.replace(/"/g, '""')}"` : val
    }).join(','))
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function DepartureResponse() {
  const { profile }   = useAuth()
  const issuerId      = profile?.issuer_id

  const [agreements, setAgreements] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [search, setSearch]         = useState('')
  const [sortCol, setSortCol]       = useState('outstanding_balance')
  const [sortDir, setSortDir]       = useState('desc')

  const load = useCallback(async () => {
    if (!issuerId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('agreements')
      .select('*, recipients(id, first_name, last_name, title, email, personal_email, mobile_phone, last_login_at)')
      .eq('issuer_id', issuerId)
      .in('status', ['terminated', 'collected', 'cancelled'])
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) { setError(error.message); return }
    setAgreements(data)
  }, [issuerId])

  useEffect(() => { load() }, [load])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortIcon(col) {
    return <SortIcon dir={sortCol === col ? sortDir : null} />
  }

  const filtered = agreements
    .filter(a => {
      const q    = search.toLowerCase()
      const name = `${a.recipients?.first_name ?? ''} ${a.recipients?.last_name ?? ''}`.toLowerCase()
      return !q || name.includes(q) || a.agreement_number?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (sortCol === 'recipient_name') {
        av = `${a.recipients?.last_name} ${a.recipients?.first_name}`
        bv = `${b.recipients?.last_name} ${b.recipients?.first_name}`
      }
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })

  function exportData() {
    const rows = filtered.map(a => ({
      'Recipient':          `${a.recipients?.first_name ?? ''} ${a.recipients?.last_name ?? ''}`.trim(),
      'Work Email':         a.recipients?.email ?? '',
      'Personal Email':     a.recipients?.personal_email ?? '',
      'Mobile Phone':       a.recipients?.mobile_phone ?? '',
      'Bonus Type':         BONUS_TYPE_LABELS[a.bonus_type] ?? a.bonus_type,
      'Agreement Number':   a.agreement_number ?? '',
      'Principal':          a.principal_amount ?? 0,
      'Outstanding Balance':a.outstanding_balance ?? 0,
      'Status':             a.status,
      'Effective Date':     a.effective_date ?? '',
      'Execution Date':     a.execution_date ?? '',
      'Work State':         a.recipient_state ?? '',
      'Acknowledged':       a.acknowledged_at ? new Date(a.acknowledged_at).toLocaleDateString() : '',
      'Last Login':         a.recipients?.last_login_at ? new Date(a.recipients.last_login_at).toLocaleDateString() : '',
    }))
    exportCSV(rows, `departure-response-${new Date().toISOString().split('T')[0]}.csv`)
  }

  const totalOutstanding = filtered.reduce((s, a) => s + (parseFloat(a.outstanding_balance) || 0), 0)
  const withBalance      = filtered.filter(a => (parseFloat(a.outstanding_balance) || 0) > 0)

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Departure Response</h1>
          <p className="text-slate-400 text-sm mt-1">
            {withBalance.length} with outstanding balance · {fmt(totalOutstanding)} total outstanding
          </p>
        </div>
        {filtered.length > 0 && (
          <button onClick={exportData}
            className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            <DownloadIcon className="w-4 h-4" /> Export
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Agreements"    value={agreements.length} />
        <SummaryCard label="With Balance"        value={withBalance.length} />
        <SummaryCard label="Total Outstanding"   value={fmt(totalOutstanding)} />
        <SummaryCard label="Avg Outstanding"     value={withBalance.length ? fmt(totalOutstanding / withBalance.length) : '—'} />
      </div>

      <div className="mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by recipient name or agreement number…"
          className="w-full sm:w-96 bg-slate-900 border border-slate-800 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <p className="text-slate-200 font-medium mb-1">No departure response agreements</p>
            <p className="text-slate-500 text-sm">Terminated, collected, or cancelled agreements will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition" onClick={() => toggleSort('recipient_name')}>
                    Recipient{sortIcon('recipient_name')}
                  </th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition" onClick={() => toggleSort('principal_amount')}>
                    Principal{sortIcon('principal_amount')}
                  </th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition" onClick={() => toggleSort('outstanding_balance')}>
                    Outstanding{sortIcon('outstanding_balance')}
                  </th>
                  <th className="text-left px-5 py-3 font-medium">Contact</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition" onClick={() => toggleSort('status')}>
                    Status{sortIcon('status')}
                  </th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition" onClick={() => toggleSort('acknowledged_at')}>
                    Acknowledged{sortIcon('acknowledged_at')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5">
                      <p className="text-slate-200 font-medium">
                        {a.recipients ? `${a.recipients.first_name} ${a.recipients.last_name}` : '—'}
                      </p>
                      {a.agreement_number && <p className="text-slate-500 text-xs mt-0.5">No. {a.agreement_number}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{BONUS_TYPE_LABELS[a.bonus_type] ?? a.bonus_type}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono">{fmt(a.principal_amount)}</td>
                    <td className="px-5 py-3.5">
                      <p className={`font-mono font-semibold ${parseFloat(a.outstanding_balance) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {fmt(a.outstanding_balance)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-300 text-xs">{a.recipients?.email ?? '—'}</p>
                      {a.recipients?.personal_email && <p className="text-slate-500 text-xs mt-0.5">{a.recipients.personal_email}</p>}
                      {a.recipients?.mobile_phone   && <p className="text-slate-500 text-xs mt-0.5">{a.recipients.mobile_phone}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLES[a.status] ?? STATUS_STYLES.cancelled}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {a.acknowledged_at
                        ? <p className="text-emerald-400 text-xs">{fmtDate(a.acknowledged_at.split('T')[0])}</p>
                        : <p className="text-slate-600 text-xs italic">Not acknowledged</p>
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

function SummaryCard({ label, value }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-xl font-semibold font-mono">{value}</p>
    </div>
  )
}
