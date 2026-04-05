import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ── Constants ──────────────────────────────────────────────
const BONUS_TYPES = [
  { value: 'signing_bonus',     label: 'Signing Bonus — Promissory Note' },
  { value: 'starting_bonus',    label: 'Starting Bonus' },
  { value: 'retention_bonus',   label: 'Retention Bonus' },
  { value: 'performance_bonus', label: 'Performance Bonus' },
  { value: 'custom',            label: 'Custom' },
]

const INTEREST_RATE_TYPES = [
  { value: 'fixed',       label: 'Fixed Rate' },
  { value: 'afr_short',   label: 'AFR Short-Term' },
  { value: 'afr_mid',     label: 'AFR Mid-Term' },
  { value: 'prime_based', label: 'Prime-Based' },
  { value: 'zero',        label: '0% — Non-Interest' },
]

const FORGIVENESS_FREQUENCIES = [
  { value: 'biweekly',     label: 'Biweekly' },
  { value: 'semi_monthly', label: 'Semi-Monthly' },
  { value: 'monthly',      label: 'Monthly' },
  { value: 'quarterly',    label: 'Quarterly' },
  { value: 'annual',       label: 'Annual' },
  { value: 'custom',       label: 'Custom' },
]

const AGREEMENT_STATUSES = [
  { value: 'draft',      label: 'Draft' },
  { value: 'active',     label: 'Active' },
  { value: 'forgiven',   label: 'Forgiven' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'collected',  label: 'Collected' },
  { value: 'cancelled',  label: 'Cancelled' },
]

const STATUS_STYLES = {
  draft:      'bg-slate-500/10 text-slate-400 border-slate-500/20',
  active:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  forgiven:   'bg-brand-500/10 text-brand-400 border-brand-500/20',
  terminated: 'bg-red-500/10 text-red-400 border-red-500/20',
  collected:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  cancelled:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

const FILTER_OPTIONS = [
  { value: 'active',    label: 'Active' },
  { value: 'all',       label: 'All' },
  { value: 'draft',     label: 'Draft' },
  { value: 'forgiven',  label: 'Forgiven' },
  { value: 'terminated',label: 'Terminated' },
]

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const isPromissory = t => t === 'signing_bonus'

// ── Icons ──────────────────────────────────────────────────
function PlusIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>
}
function XIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
}
function FileIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z"/><path d="M9 2v4h4"/></svg>
}

// ── Form helpers ───────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', required, hint, prefix, suffix }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">
        {label}{required && <span className="text-brand-400 ml-0.5">*</span>}
      </label>
      <div className="flex">
        {prefix && <span className="flex items-center px-3 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-slate-400 text-sm">{prefix}</span>}
        <input
          type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition ${prefix ? 'rounded-r-lg' : suffix ? 'rounded-l-lg' : 'rounded-lg'}`}
        />
        {suffix && <span className="flex items-center px-3 bg-slate-700 border border-l-0 border-slate-600 rounded-r-lg text-slate-400 text-sm">{suffix}</span>}
      </div>
      {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, options, required, hint }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">
        {label}{required && <span className="text-brand-400 ml-0.5">*</span>}
      </label>
      <select
        value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
      >
        <option value="">Select…</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
    </div>
  )
}

function Toggle({ label, checked, onChange, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-9 h-5 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-700'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
      <div>
        <p className="text-slate-300 text-sm font-medium">{label}</p>
        {hint && <p className="text-slate-500 text-xs mt-0.5">{hint}</p>}
      </div>
    </label>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  )
}

// ── Amortization preview ───────────────────────────────────
function calcAmortization(principal, rate, periods, frequency) {
  if (!principal || !periods) return null
  const periodsPerYear = { biweekly: 26, semi_monthly: 24, monthly: 12, quarterly: 4, annual: 1, custom: 12 }[frequency] || 12
  const annualRate = parseFloat(rate) || 0
  const periodRate = annualRate / 100 / periodsPerYear
  const forgivePerPeriod = principal / periods
  const imputedPerPeriod = principal * (annualRate / 100) / periodsPerYear

  return {
    forgivePerPeriod: forgivePerPeriod.toFixed(2),
    imputedPerPeriod: imputedPerPeriod.toFixed(2),
    totalImputed: (imputedPerPeriod * periods).toFixed(2),
    periodsPerYear,
  }
}

// ── Agreement drawer ───────────────────────────────────────
const EMPTY_FORM = {
  bonus_type: 'signing_bonus',
  recipient_id: '',
  agreement_number: '',
  principal_amount: '',
  interest_rate: '',
  interest_rate_type: 'fixed',
  forgiveness_start_date: '',
  forgiveness_frequency: 'monthly',
  forgiveness_periods: '',
  execution_date: '',
  effective_date: '',
  status: 'draft',
  notes: '',
  // Eligibility
  elig_min_fte: '',
  elig_benefits_eligible: false,
  elig_maintain_role: false,
  elig_licensure_required: false,
  elig_notes: '',
}

function AgreementDrawer({ issuerId, recipients, agreement, onClose, onSaved }) {
  const [form, setForm]     = useState(agreement ? {
    ...EMPTY_FORM,
    ...agreement,
    elig_min_fte:             agreement.eligibility_criteria?.min_fte ?? '',
    elig_benefits_eligible:   agreement.eligibility_criteria?.benefits_eligible ?? false,
    elig_maintain_role:       agreement.eligibility_criteria?.maintain_role ?? false,
    elig_licensure_required:  agreement.eligibility_criteria?.licensure_required ?? false,
    elig_notes:               agreement.eligibility_criteria?.notes ?? '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const isEdit              = !!agreement

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // Auto-calculate projected end date
  const amort = calcAmortization(
    parseFloat(form.principal_amount),
    form.interest_rate,
    parseInt(form.forgiveness_periods),
    form.forgiveness_frequency
  )

  async function handleSave(e) {
    e.preventDefault()

    // Validation by bonus type
    const required = ['bonus_type', 'recipient_id', 'principal_amount', 'forgiveness_start_date', 'forgiveness_frequency', 'forgiveness_periods']
    if (isPromissory(form.bonus_type)) required.push('interest_rate', 'interest_rate_type', 'execution_date')

    for (const f of required) {
      if (!form[f]) { setError(`Please fill in all required fields.`); return }
    }

    setSaving(true)
    setError(null)

    // Build eligibility_criteria
    const eligibility_criteria = {
      min_fte:             form.elig_min_fte ? parseFloat(form.elig_min_fte) : null,
      benefits_eligible:   form.elig_benefits_eligible,
      maintain_role:       form.elig_maintain_role,
      licensure_required:  form.elig_licensure_required,
      notes:               form.elig_notes || null,
    }

    const principal = parseFloat(form.principal_amount)
    const periods   = parseInt(form.forgiveness_periods)

    const payload = {
      issuer_id:                issuerId,
      recipient_id:             form.recipient_id,
      bonus_type:               form.bonus_type,
      agreement_number:         form.agreement_number || null,
      principal_amount:         principal,
      original_principal:       isEdit ? undefined : principal,
      outstanding_balance:      isEdit ? undefined : principal,
      interest_rate:            form.interest_rate ? parseFloat(form.interest_rate) : null,
      interest_rate_type:       form.interest_rate_type || null,
      forgiveness_start_date:   form.forgiveness_start_date,
      forgiveness_frequency:    form.forgiveness_frequency,
      forgiveness_periods:      periods,
      forgiveness_amount_per_period: principal / periods,
      execution_date:           form.execution_date || null,
      effective_date:           form.effective_date || null,
      status:                   form.status,
      notes:                    form.notes || null,
      eligibility_criteria,
    }

    // Remove undefined keys
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

    let err
    if (isEdit) {
      ;({ error: err } = await supabase.from('agreements').update(payload).eq('id', agreement.id))
    } else {
      ;({ error: err } = await supabase.from('agreements').insert(payload))
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  const isPN = isPromissory(form.bonus_type)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-white font-semibold">{isEdit ? 'Edit Agreement' : 'New Agreement'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">

            {/* ── Agreement basics ── */}
            <SectionLabel>Agreement</SectionLabel>

            <SelectField
              label="Bonus Type" required
              value={form.bonus_type} onChange={v => set('bonus_type', v)}
              options={BONUS_TYPES}
            />

            {/* Recipient */}
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5">
                Recipient<span className="text-brand-400 ml-0.5">*</span>
              </label>
              <select
                value={form.recipient_id} onChange={e => set('recipient_id', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
              >
                <option value="">Select recipient…</option>
                {recipients.map(r => (
                  <option key={r.id} value={r.id}>{r.first_name} {r.last_name} {r.title ? `— ${r.title}` : ''}</option>
                ))}
              </select>
              <p className="text-slate-500 text-xs mt-1">Recipient not listed? <a href="/issuer/recipients" className="text-brand-400 hover:text-brand-300">Add them first →</a></p>
            </div>

            <Field
              label="Agreement Number"
              value={form.agreement_number} onChange={v => set('agreement_number', v)}
              placeholder="Auto-generated if left blank"
            />

            {/* ── Financial terms ── */}
            <SectionLabel>Financial Terms</SectionLabel>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label={isPN ? 'Principal Amount' : 'Bonus Amount'} required
                value={form.principal_amount} onChange={v => set('principal_amount', v)}
                type="number" prefix="$" placeholder="50000"
              />
              <SelectField
                label="Status"
                value={form.status} onChange={v => set('status', v)}
                options={AGREEMENT_STATUSES}
              />
            </div>

            {/* Promissory note — interest fields */}
            {isPN && (
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Interest Rate" required
                  value={form.interest_rate} onChange={v => set('interest_rate', v)}
                  type="number" suffix="%" placeholder="5.27"
                  hint="Annual rate"
                />
                <SelectField
                  label="Rate Type" required
                  value={form.interest_rate_type} onChange={v => set('interest_rate_type', v)}
                  options={INTEREST_RATE_TYPES}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Forgiveness Frequency" required
                value={form.forgiveness_frequency} onChange={v => set('forgiveness_frequency', v)}
                options={FORGIVENESS_FREQUENCIES}
              />
              <Field
                label="Forgiveness Periods" required
                value={form.forgiveness_periods} onChange={v => set('forgiveness_periods', v)}
                type="number" placeholder="36"
                hint="Total number of periods"
              />
            </div>

            {/* Amortization preview */}
            {amort && form.principal_amount && form.forgiveness_periods && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Schedule Preview</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-slate-500 text-xs">Forgiven per period</p>
                    <p className="text-white font-mono font-semibold">{fmt(amort.forgivePerPeriod)}</p>
                  </div>
                  {isPN && parseFloat(form.interest_rate) > 0 && (
                    <>
                      <div>
                        <p className="text-slate-500 text-xs">Imputed income / period</p>
                        <p className="text-white font-mono font-semibold">{fmt(amort.imputedPerPeriod)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-slate-500 text-xs">Total imputed income</p>
                        <p className="text-brand-400 font-mono font-semibold">{fmt(amort.totalImputed)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Dates ── */}
            <SectionLabel>Dates</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {isPN && (
                <Field
                  label="Execution Date" required={isPN}
                  value={form.execution_date} onChange={v => set('execution_date', v)}
                  type="date" hint="Date note was signed"
                />
              )}
              <Field
                label="Effective Date"
                value={form.effective_date} onChange={v => set('effective_date', v)}
                type="date" hint="First day of employment / bonus period"
              />
              <Field
                label="Forgiveness Start Date" required
                value={form.forgiveness_start_date} onChange={v => set('forgiveness_start_date', v)}
                type="date" hint="First forgiveness period begins"
              />
            </div>

            {/* ── Eligibility criteria ── */}
            <SectionLabel>Eligibility Criteria</SectionLabel>
            <p className="text-slate-500 text-xs -mt-2">Conditions the recipient must maintain for the agreement to remain active. Displayed to the recipient in their portal.</p>

            <div className="flex flex-col gap-3">
              <Toggle
                label="Benefits Eligible Required"
                checked={form.elig_benefits_eligible}
                onChange={v => set('elig_benefits_eligible', v)}
                hint="Recipient must remain benefits-eligible"
              />
              <Toggle
                label="Must Maintain Role"
                checked={form.elig_maintain_role}
                onChange={v => set('elig_maintain_role', v)}
                hint="Recipient must remain in the role this agreement was issued for"
              />
              <Toggle
                label="Licensure Required"
                checked={form.elig_licensure_required}
                onChange={v => set('elig_licensure_required', v)}
                hint="Recipient must maintain active license / credentialing"
              />
            </div>

            <Field
              label="Minimum FTE"
              value={form.elig_min_fte} onChange={v => set('elig_min_fte', v)}
              type="number" placeholder="0.8"
              hint="e.g. 0.8 = must remain at or above 80% FTE"
            />

            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5">Additional Eligibility Notes</label>
              <textarea
                value={form.elig_notes || ''}
                onChange={e => set('elig_notes', e.target.value)}
                placeholder="Any additional eligibility conditions specific to this agreement…"
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition resize-none"
              />
            </div>

            {/* ── Notes ── */}
            <SectionLabel>Notes</SectionLabel>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5">Internal Notes</label>
              <textarea
                value={form.notes || ''}
                onChange={e => set('notes', e.target.value)}
                placeholder="Internal context about this agreement…"
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-4 border-t border-slate-800 flex gap-3 bg-slate-900">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium transition">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Agreement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────
function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-4">
        <FileIcon className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-slate-200 font-medium mb-1">No agreements yet</p>
      <p className="text-slate-500 text-sm mb-6 max-w-xs">Create your first agreement to start tracking bonuses and forgiveness schedules.</p>
      <button onClick={onAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
        <PlusIcon className="w-4 h-4" /> New Agreement
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function Agreements() {
  const { profile } = useAuth()
  const issuerId    = profile?.issuer_id

  const [agreements, setAgreements] = useState([])
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing]       = useState(null)
  const [filter, setFilter]         = useState('active')
  const [search, setSearch]         = useState('')

  const load = useCallback(async () => {
    if (!issuerId) return
    setLoading(true)
    const [agRes, recRes] = await Promise.all([
      supabase
        .from('agreements')
        .select('*, recipients(id, first_name, last_name, title)')
        .eq('issuer_id', issuerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('recipients')
        .select('id, first_name, last_name, title')
        .eq('issuer_id', issuerId)
        .eq('is_active', true)
        .order('last_name'),
    ])
    setLoading(false)
    if (agRes.error)  { setError(agRes.error.message);  return }
    if (recRes.error) { setError(recRes.error.message); return }
    setAgreements(agRes.data)
    setRecipients(recRes.data)
  }, [issuerId])

  useEffect(() => { load() }, [load])

  function openAdd()     { setEditing(null); setDrawerOpen(true) }
  function openEdit(a)   { setEditing(a);    setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }
  function onSaved()     { closeDrawer(); load() }

  // Status counts
  const counts = AGREEMENT_STATUSES.reduce((acc, s) => {
    acc[s.value] = agreements.filter(a => a.status === s.value).length
    return acc
  }, { all: agreements.length })

  const filtered = agreements.filter(a => {
    const matchFilter = filter === 'all' ? true : a.status === filter
    const q = search.toLowerCase()
    const name = `${a.recipients?.first_name ?? ''} ${a.recipients?.last_name ?? ''}`.toLowerCase()
    const matchSearch = !q || name.includes(q) || a.agreement_number?.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const bonusTypeLabel = t => BONUS_TYPES.find(b => b.value === t)?.label?.split(' — ')[0] ?? t

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Agreements</h1>
          <p className="text-slate-400 text-sm mt-1">
            {counts.active} active · {counts.all} total
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition w-full sm:w-auto justify-center">
          <PlusIcon className="w-4 h-4" /> New Agreement
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
      )}

      {/* Filters + search */}
      {agreements.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by recipient or agreement number…"
            className="flex-1 bg-slate-900 border border-slate-800 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
          />
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 flex-wrap">
            {FILTER_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setFilter(o.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${filter === o.value ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {o.label} {counts[o.value] > 0 && <span className="ml-1 opacity-60">{counts[o.value]}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 && agreements.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">No agreements match your filter</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                  <th className="text-left px-5 py-3 font-medium">Recipient</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium">Principal</th>
                  <th className="text-left px-5 py-3 font-medium">Outstanding</th>
                  <th className="text-left px-5 py-3 font-medium">Effective</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
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
                      {a.agreement_number && <p className="text-slate-500 text-xs mt-0.5">#{a.agreement_number}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs capitalize">
                      {bonusTypeLabel(a.bonus_type)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono">{fmt(a.principal_amount)}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono">{fmt(a.outstanding_balance)}</td>
                    <td className="px-5 py-3.5 text-slate-400">{fmtDate(a.effective_date)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLES[a.status] ?? STATUS_STYLES.draft}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openEdit(a)}
                        className="text-xs font-medium text-slate-400 hover:text-white transition px-2 py-1 rounded hover:bg-slate-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawerOpen && (
        <AgreementDrawer
          issuerId={issuerId}
          recipients={recipients}
          agreement={editing}
          onClose={closeDrawer}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
