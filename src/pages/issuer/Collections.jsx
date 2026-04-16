import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const fmt     = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const BONUS_TYPE_LABELS = {
  signing_bonus: 'Signing Bonus', starting_bonus: 'Starting Bonus',
  retention_bonus: 'Retention Bonus', performance_bonus: 'Performance Bonus', custom: 'Custom',
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
function XIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
}

function exportCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map(row => headers.map(h => {
    const val = row[h] ?? ''
    return typeof val === 'string' && (val.includes(',') || val.includes('"')) ? `"${val.replace(/"/g, '""')}"` : val
  }).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Departure notice modal ─────────────────────────────────
function DepartureNoticeModal({ agreement, onClose, onSent }) {
  const fmt2 = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n ?? 0)
  const [balanceOverride, setBalanceOverride] = useState(agreement.outstanding_balance ?? '')
  const [customMessage, setCustomMessage]     = useState('')
  const [sending, setSending]                 = useState(false)
  const [error, setError]                     = useState(null)

  const recipientEmail = agreement.recipients?.personal_email || agreement.recipients?.email
  const recipientName  = `${agreement.recipients?.first_name ?? ''} ${agreement.recipients?.last_name ?? ''}`.trim()

  async function handleSend() {
    setSending(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await supabase.functions.invoke('send-departure-notice', {
      body: {
        agreement_id: agreement.id,
        outstanding_balance_override: parseFloat(balanceOverride) || null,
        custom_message: customMessage || null,
      },
      headers: { Authorization: `Bearer ${session?.access_token}` }
    })
    setSending(false)
    if (res.error || res.data?.error) {
      setError(res.data?.error ?? res.error?.message)
      return
    }
    onSent(res.data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-white font-semibold">Send Departure Notice</h2>
            <p className="text-slate-500 text-xs mt-0.5">to {recipientName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

          {/* Recipient info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Sending To</p>
            <p className="text-slate-200 text-sm font-medium">{recipientName}</p>
            <p className="text-brand-400 text-sm">{recipientEmail}</p>
            {!agreement.recipients?.personal_email && (
              <p className="text-yellow-400 text-xs mt-1">⚠ No personal email on file — sending to work email</p>
            )}
          </div>

          {/* Agreement summary */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Agreement</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-slate-500 text-xs">Agreement No.</p><p className="text-slate-200">{agreement.agreement_number || '—'}</p></div>
              <div><p className="text-slate-500 text-xs">Type</p><p className="text-slate-200">{BONUS_TYPE_LABELS[agreement.bonus_type]}</p></div>
              <div><p className="text-slate-500 text-xs">Original Principal</p><p className="text-slate-200 font-mono">{fmt(agreement.principal_amount)}</p></div>
              <div><p className="text-slate-500 text-xs">Acknowledged</p><p className="text-slate-200">{agreement.acknowledged_at ? fmtDate(agreement.acknowledged_at.split('T')[0]) : 'Not acknowledged'}</p></div>
            </div>
          </div>

          {/* Outstanding balance — editable */}
          <div>
            <label className="block text-slate-300 text-xs font-medium mb-1.5">
              Outstanding Balance
              <span className="text-slate-500 font-normal ml-2">— override if needed</span>
            </label>
            <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden bg-slate-800">
              <span className="px-3 text-slate-400 text-sm border-r border-slate-700 py-2.5">$</span>
              <input
                type="number"
                value={balanceOverride}
                onChange={e => setBalanceOverride(e.target.value)}
                className="flex-1 bg-transparent text-white px-3 py-2.5 text-sm focus:outline-none font-mono"
                step="0.01"
              />
            </div>
            <p className="text-slate-600 text-xs mt-1">Gross amount — pre-tax. Disclaimer included in email automatically.</p>
          </div>

          {/* Custom message */}
          <div>
            <label className="block text-slate-300 text-xs font-medium mb-1.5">
              Custom Message
              <span className="text-slate-500 font-normal ml-2">— optional</span>
            </label>
            <textarea
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              placeholder="Add a personal message to include at the top of the notice. For example: 'As discussed during your exit meeting on [date], please review the details of your outstanding agreement below.'"
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition resize-none"
            />
          </div>

          {/* What the email includes */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Email will include</p>
            <div className="flex flex-col gap-1.5 text-slate-500 text-xs">
              <p>• Recipient name and organization</p>
              <p>• Agreement number, type, and original principal</p>
              <p>• Acknowledgment date (proof they agreed to terms)</p>
              <p>• Outstanding balance (gross amount, pre-tax)</p>
              <p>• Gross amount disclaimer</p>
              <p>• Your HR contact name and email</p>
              <p>• Your custom message (if provided)</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">{error}</div>
          )}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-slate-800 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending}
            className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium transition">
            {sending ? 'Sending…' : 'Send Notice →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function DepartureResponse() {
  const { profile }   = useAuth()
  const issuerId      = profile?.issuer_id

  const [agreements, setAgreements]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [search, setSearch]           = useState('')
  const [sortCol, setSortCol]         = useState('outstanding_balance')
  const [sortDir, setSortDir]         = useState('desc')
  const [noticeAgreement, setNoticeAgreement] = useState(null)
  const [sentConfirm, setSentConfirm] = useState(null)

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
      'Recipient':           `${a.recipients?.first_name ?? ''} ${a.recipients?.last_name ?? ''}`.trim(),
      'Work Email':          a.recipients?.email ?? '',
      'Personal Email':      a.recipients?.personal_email ?? '',
      'Mobile Phone':        a.recipients?.mobile_phone ?? '',
      'Bonus Type':          BONUS_TYPE_LABELS[a.bonus_type] ?? a.bonus_type,
      'Agreement Number':    a.agreement_number ?? '',
      'Principal':           a.principal_amount ?? 0,
      'Outstanding Balance': a.outstanding_balance ?? 0,
      'Status':              a.status,
      'Effective Date':      a.effective_date ?? '',
      'Execution Date':      a.execution_date ?? '',
      'Work State':          a.recipient_state ?? '',
      'Acknowledged':        a.acknowledged_at ? new Date(a.acknowledged_at).toLocaleDateString() : '',
      'Last Login':          a.recipients?.last_login_at ? new Date(a.recipients.last_login_at).toLocaleDateString() : '',
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

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>}

      {sentConfirm && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
          <p className="text-emerald-400 text-sm">✓ Departure notice sent to {sentConfirm.sent_to}</p>
          <button onClick={() => setSentConfirm(null)} className="text-slate-500 hover:text-slate-300 text-xs transition">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Agreements"  value={agreements.length} />
        <SummaryCard label="With Balance"      value={withBalance.length} />
        <SummaryCard label="Total Outstanding" value={fmt(totalOutstanding)} />
        <SummaryCard label="Avg Outstanding"   value={withBalance.length ? fmt(totalOutstanding / withBalance.length) : '—'} />
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
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition" onClick={() => toggleSort('recipient_name')}>Recipient{sortIcon('recipient_name')}</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition" onClick={() => toggleSort('principal_amount')}>Principal{sortIcon('principal_amount')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition" onClick={() => toggleSort('outstanding_balance')}>Outstanding{sortIcon('outstanding_balance')}</th>
                  <th className="text-left px-5 py-3 font-medium">Contact</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition" onClick={() => toggleSort('status')}>Status{sortIcon('status')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition" onClick={() => toggleSort('acknowledged_at')}>Acknowledged{sortIcon('acknowledged_at')}</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
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
                    <td className="px-5 py-3.5 text-right">
                      {parseFloat(a.outstanding_balance) > 0 && (
                        <button
                          onClick={() => setNoticeAgreement(a)}
                          className="text-xs font-semibold text-brand-400 hover:text-brand-300 border border-brand-600/40 hover:border-brand-500 px-3 py-1.5 rounded-lg transition">
                          Send Notice
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {noticeAgreement && (
        <DepartureNoticeModal
          agreement={noticeAgreement}
          onClose={() => setNoticeAgreement(null)}
          onSent={data => { setNoticeAgreement(null); setSentConfirm(data); load() }}
        />
      )}
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
// Wed Apr 15 22:25:48 CDT 2026
