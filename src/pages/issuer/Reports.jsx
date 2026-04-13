import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ── Helpers ────────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n ?? 0)
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
const fmtDateTime = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

function bizDays(start, end) {
  if (!start || !end) return ''
  const d1 = new Date(start), d2 = new Date(end)
  if (d2 <= d1) return 0
  let count = 0
  const cur = new Date(d1)
  cur.setDate(cur.getDate() + 1)
  while (cur <= d2) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function exportCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = v => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Icons ──────────────────────────────────────────────────
function DownloadIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M2 12v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1"/></svg>
}

const BONUS_TYPE_LABELS = {
  signing_bonus: 'Signing Bonus', starting_bonus: 'Starting Bonus',
  retention_bonus: 'Retention Bonus', performance_bonus: 'Performance Bonus', custom: 'Custom',
}

// ── Filter bar ─────────────────────────────────────────────
function FilterBar({ filters, onChange }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-4 items-end">
      <div>
        <label className="block text-slate-400 text-xs font-medium mb-1.5">Date Range — Start</label>
        <input type="date" value={filters.dateFrom} onChange={e => onChange('dateFrom', e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition" />
      </div>
      <div>
        <label className="block text-slate-400 text-xs font-medium mb-1.5">Date Range — End</label>
        <input type="date" value={filters.dateTo} onChange={e => onChange('dateTo', e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition" />
      </div>
      <div>
        <label className="block text-slate-400 text-xs font-medium mb-1.5">Status</label>
        <select value={filters.status} onChange={e => onChange('status', e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition">
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="onboarding">Onboarding</option>
          <option value="active">Active</option>
          <option value="forgiven">Forgiven</option>
          <option value="terminated">Terminated</option>
          <option value="collected">Collected</option>
        </select>
      </div>
      <div>
        <label className="block text-slate-400 text-xs font-medium mb-1.5">Bonus Type</label>
        <select value={filters.bonusType} onChange={e => onChange('bonusType', e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition">
          <option value="all">All Types</option>
          <option value="signing_bonus">Signing Bonus</option>
          <option value="starting_bonus">Starting Bonus</option>
          <option value="retention_bonus">Retention Bonus</option>
          <option value="performance_bonus">Performance Bonus</option>
        </select>
      </div>
      <div className="flex items-center gap-2 pb-0.5">
        <input type="checkbox" id="ackOnly" checked={filters.acknowledgedOnly}
          onChange={e => onChange('acknowledgedOnly', e.target.checked)}
          className="w-4 h-4 rounded" />
        <label htmlFor="ackOnly" className="text-slate-300 text-sm cursor-pointer">Acknowledged only</label>
      </div>
      <button onClick={() => onChange('reset')}
        className="text-slate-500 hover:text-slate-300 text-xs font-medium transition pb-0.5">
        Reset filters
      </button>
    </div>
  )
}

// ── Report section card ────────────────────────────────────
function ReportCard({ title, description, count, onExport, exporting, disabled }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between gap-4">
      <div>
        <h3 className="text-white font-medium">{title}</h3>
        <p className="text-slate-400 text-sm mt-0.5">{description}</p>
        {count !== null && count !== undefined && (
          <p className="text-slate-500 text-xs mt-1">{count} rows</p>
        )}
      </div>
      <button
        onClick={onExport}
        disabled={exporting || disabled}
        className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 text-sm font-medium px-4 py-2.5 rounded-lg transition shrink-0">
        <DownloadIcon className="w-4 h-4" />
        {exporting ? 'Generating…' : 'Export CSV'}
      </button>
    </div>
  )
}

// ── Main Reports page ──────────────────────────────────────
export default function Reports() {
  const { profile } = useAuth()
  const issuerId    = profile?.issuer_id

  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState({})
  const [counts, setCounts]       = useState({})
  const [filters, setFilters]     = useState({
    dateFrom: '', dateTo: '', status: 'all', bonusType: 'all', acknowledgedOnly: false,
  })

  useEffect(() => { if (issuerId) loadCounts() }, [issuerId, filters])

  function updateFilter(key, value) {
    if (key === 'reset') {
      setFilters({ dateFrom: '', dateTo: '', status: 'all', bonusType: 'all', acknowledgedOnly: false })
      return
    }
    setFilters(f => ({ ...f, [key]: value }))
  }

  function applyAgreementFilters(query) {
    query = query.eq('issuer_id', issuerId)
    if (filters.status !== 'all')   query = query.eq('status', filters.status)
    if (filters.bonusType !== 'all') query = query.eq('bonus_type', filters.bonusType)
    if (filters.dateFrom)           query = query.gte('execution_date', filters.dateFrom)
    if (filters.dateTo)             query = query.lte('execution_date', filters.dateTo)
    if (filters.acknowledgedOnly)   query = query.not('acknowledged_at', 'is', null)
    return query
  }

  async function loadCounts() {
    setLoading(true)
    const [agRes, recRes, schedRes, evtRes] = await Promise.all([
      applyAgreementFilters(supabase.from('agreements').select('id', { count: 'exact', head: true })),
      supabase.from('recipients').select('id', { count: 'exact', head: true }).eq('issuer_id', issuerId),
      supabase.from('amortization_schedule').select('id', { count: 'exact', head: true })
        .in('agreement_id', await getFilteredAgreementIds()),
      supabase.from('recipient_events').select('id', { count: 'exact', head: true }).eq('issuer_id', issuerId),
    ])
    setCounts({
      agreements:  agRes.count ?? 0,
      recipients:  recRes.count ?? 0,
      schedule:    schedRes.count ?? 0,
      events:      evtRes.count ?? 0,
    })
    setLoading(false)
  }

  async function getFilteredAgreementIds() {
    const { data } = await applyAgreementFilters(supabase.from('agreements').select('id'))
    return (data ?? []).map(a => a.id)
  }

  async function exportAgreementRegister() {
    setExporting(e => ({ ...e, agreements: true }))
    const { data: ags } = await applyAgreementFilters(
      supabase.from('agreements').select('*, recipients(first_name, last_name, email, personal_email, mobile_phone, first_login_at, last_login_at)')
    ).order('execution_date')

    const rows = (ags ?? []).map(a => ({
      'Agreement Number':              a.agreement_number ?? '',
      'Recipient':                     `${a.recipients?.first_name ?? ''} ${a.recipients?.last_name ?? ''}`.trim(),
      'Work Email':                    a.recipients?.email ?? '',
      'Personal Email':                a.recipients?.personal_email ?? '',
      'Mobile Phone':                  a.recipients?.mobile_phone ?? '',
      'Bonus Type':                    BONUS_TYPE_LABELS[a.bonus_type] ?? a.bonus_type,
      'Status':                        a.status,
      'Principal Amount':              a.principal_amount ?? 0,
      'Outstanding Balance':           a.outstanding_balance ?? 0,
      'Interest Rate':                 a.interest_rate ?? '',
      'Forgiveness Frequency':         a.forgiveness_frequency ?? '',
      'Forgiveness Periods':           a.forgiveness_periods ?? '',
      'Work State':                    a.recipient_state ?? '',
      'Execution Date':                fmtDate(a.execution_date),
      'Effective Date':                fmtDate(a.effective_date),
      'Forgiveness Start Date':        fmtDate(a.forgiveness_start_date),
      'Projected End Date':            fmtDate(a.projected_end_date),
      'Acknowledged At':               fmtDateTime(a.acknowledged_at),
      'Business Days — Exec to First Access': bizDays(a.execution_date, a.recipients?.first_login_at),
      'Business Days — Exec to Acknowledgment': bizDays(a.execution_date, a.acknowledged_at),
      'DocuSign Status':               a.docusign_status ?? '',
    }))

    exportCSV(rows, `agreement-register-${new Date().toISOString().split('T')[0]}.csv`)
    setExporting(e => ({ ...e, agreements: false }))
  }

  async function exportRecipientActivity() {
    setExporting(e => ({ ...e, recipients: true }))
    const { data: recs } = await supabase
      .from('recipients')
      .select('*, agreements(id, status)')
      .eq('issuer_id', issuerId)
      .order('last_name')

    const { data: events } = await supabase
      .from('recipient_events')
      .select('recipient_id, event_type, created_at')
      .eq('issuer_id', issuerId)

    const rows = (recs ?? []).map(r => {
      const recEvents  = (events ?? []).filter(e => e.recipient_id === r.id)
      const loginCount = recEvents.filter(e => e.event_type === 'login').length
      const updateCount = recEvents.filter(e => e.event_type === 'contact_update').length
      return {
        'First Name':            r.first_name,
        'Last Name':             r.last_name,
        'Employee ID':           r.employee_id ?? '',
        'Title':                 r.title ?? '',
        'Department':            r.department ?? '',
        'Work Email':            r.email,
        'Personal Email':        r.personal_email ?? '',
        'Mobile Phone':          r.mobile_phone ?? '',
        'Work State':            r.state ?? '',
        'Active':                r.is_active ? 'Yes' : 'No',
        'Invite Sent At':        fmtDateTime(r.invite_sent_at),
        'First Login At':        fmtDateTime(r.first_login_at),
        'Last Login At':         fmtDateTime(r.last_login_at),
        'Onboarding Complete':   r.onboarding_complete ? 'Yes' : 'No',
        'Total Portal Logins':   loginCount,
        'Contact Updates':       updateCount,
        'Active Agreements':     r.agreements?.filter(a => a.status === 'active').length ?? 0,
        'Total Agreements':      r.agreements?.length ?? 0,
        'Notifications Opted Out': r.notifications_opted_out ? 'Yes' : 'No',
      }
    })

    exportCSV(rows, `recipient-activity-${new Date().toISOString().split('T')[0]}.csv`)
    setExporting(e => ({ ...e, recipients: false }))
  }

  async function exportAmortizationSchedule() {
    setExporting(e => ({ ...e, schedule: true }))
    const ids = await getFilteredAgreementIds()
    if (!ids.length) { setExporting(e => ({ ...e, schedule: false })); return }

    const { data: rows } = await supabase
      .from('amortization_schedule')
      .select('*, agreements(agreement_number, bonus_type, recipients(first_name, last_name))')
      .in('agreement_id', ids)
      .order('agreement_id')
      .order('period_number')

    const csvRows = (rows ?? []).map(r => ({
      'Agreement Number':    r.agreements?.agreement_number ?? '',
      'Recipient':           `${r.agreements?.recipients?.first_name ?? ''} ${r.agreements?.recipients?.last_name ?? ''}`.trim(),
      'Bonus Type':          BONUS_TYPE_LABELS[r.agreements?.bonus_type] ?? '',
      'Period Number':       r.period_number,
      'Period Start Date':   fmtDate(r.period_start_date),
      'Period End Date':     fmtDate(r.period_end_date),
      'Opening Balance':     r.beginning_balance ?? 0,
      'Forgiven Principal':  r.forgiveness_amount ?? 0,
      'Forgiven Interest':   r.interest_amount ?? 0,
      'Total Forgiven (Taxable Income)': r.imputed_income ?? 0,
      'Closing Balance':     r.ending_balance ?? 0,
      'Processed':           r.is_processed ? 'Yes' : 'No',
      'Processed At':        fmtDateTime(r.processed_at),
      'Exported to Payroll': r.exported_to_payroll ? 'Yes' : 'No',
      'Payroll Export Date': fmtDate(r.payroll_export_date),
      'Payroll Export Batch':r.payroll_export_batch ?? '',
    }))

    exportCSV(csvRows, `amortization-schedule-${new Date().toISOString().split('T')[0]}.csv`)
    setExporting(e => ({ ...e, schedule: false }))
  }

  async function exportAuditEventLog() {
    setExporting(e => ({ ...e, events: true }))
    let query = supabase
      .from('recipient_events')
      .select('*, recipients(first_name, last_name, email)')
      .eq('issuer_id', issuerId)
      .order('created_at', { ascending: false })

    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
    if (filters.dateTo)   query = query.lte('created_at', filters.dateTo + 'T23:59:59')

    const { data: events } = await query

    const rows = (events ?? []).map(e => ({
      'Timestamp':    fmtDateTime(e.created_at),
      'Recipient':    `${e.recipients?.first_name ?? ''} ${e.recipients?.last_name ?? ''}`.trim(),
      'Email':        e.recipients?.email ?? '',
      'Event Type':   e.event_type,
      'Field Changed':e.field_changed ?? '',
      'Old Value':    e.old_value ?? '',
      'New Value':    e.new_value ?? '',
    }))

    exportCSV(rows, `audit-event-log-${new Date().toISOString().split('T')[0]}.csv`)
    setExporting(e => ({ ...e, events: false }))
  }

  async function exportFullAuditPackage() {
    setExporting(e => ({ ...e, full: true }))
    await exportAgreementRegister()
    await exportRecipientActivity()
    await exportAmortizationSchedule()
    await exportAuditEventLog()
    setExporting(e => ({ ...e, full: false }))
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Audit Reports</h1>
          <p className="text-slate-400 text-sm mt-1">Export compliance documentation for your bonus agreements</p>
        </div>
        <button onClick={exportFullAuditPackage} disabled={exporting.full || loading}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <DownloadIcon className="w-4 h-4" />
          {exporting.full ? 'Generating…' : 'Export Full Audit Package'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-6">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Filters — applied to all exports</p>
        <FilterBar filters={filters} onChange={updateFilter} />
      </div>

      {/* Report cards */}
      <div className="flex flex-col gap-3">

        <ReportCard
          title="Agreement Register"
          description="All agreements with recipient details, financial terms, acknowledgment timestamps, and business day review periods"
          count={loading ? null : counts.agreements}
          onExport={exportAgreementRegister}
          exporting={exporting.agreements}
        />

        <ReportCard
          title="Recipient Activity"
          description="All recipients with invite sent date, first login, last login, onboarding status, portal logins, and contact update history"
          count={loading ? null : counts.recipients}
          onExport={exportRecipientActivity}
          exporting={exporting.recipients}
        />

        <ReportCard
          title="Forgiveness Schedule"
          description="Full period-by-period amortization schedule — opening balance, forgiven principal, forgiven interest, total forgiven (taxable income), closing balance"
          count={loading ? null : counts.schedule}
          onExport={exportAmortizationSchedule}
          exporting={exporting.schedule}
        />

        <ReportCard
          title="Audit Event Log"
          description="Complete timestamped record of all recipient events — logins, acknowledgments, contact updates, invite sends"
          count={loading ? null : counts.events}
          onExport={exportAuditEventLog}
          exporting={exporting.events}
        />

      </div>

      {/* Compliance note */}
      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">About These Reports</p>
        <div className="flex flex-col gap-1.5 text-slate-500 text-xs">
          <p>• All exports include a timestamp of when the report was generated: {today}</p>
          <p>• Business days calculated Monday–Friday. Federal holidays not excluded.</p>
          <p>• Acknowledgment timestamps reflect when the recipient completed the BonusBridge onboarding flow and confirmed their agreement terms.</p>
          <p>• Portal login records reflect authenticated sessions — not email opens or link clicks.</p>
          <p>• These reports are generated from live data and reflect the current state of all agreements at the time of export.</p>
        </div>
      </div>

    </div>
  )
}
