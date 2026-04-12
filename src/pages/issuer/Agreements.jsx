import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { amortPreview } from '../../lib/amortization'

// ── Constants ──────────────────────────────────────────────
const BONUS_TYPES = [
  { value: 'signing_bonus',     label: 'Signing Bonus',     sub: 'Forgivable promissory note with interest and amortization' },
  { value: 'starting_bonus',    label: 'Starting Bonus',    sub: 'Upfront payroll bonus with repayment terms' },
  { value: 'retention_bonus',   label: 'Retention Bonus',   sub: 'Future payout triggered by eligibility milestone' },
  { value: 'performance_bonus', label: 'Performance Bonus', sub: 'Payout triggered by measurable milestones' },
  { value: 'custom',            label: 'Custom',            sub: 'Non-standard agreement structure' },
]

const INTEREST_RATE_TYPES = [
  { value: 'fixed',       label: 'Fixed Rate' },
  { value: 'afr_short',   label: 'AFR Short-Term' },
  { value: 'afr_mid',     label: 'AFR Mid-Term' },
  { value: 'prime_based', label: 'Prime-Based' },
  { value: 'zero',        label: 'Zero Percent — Non-Interest' },
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
  { value: 'draft',       label: 'Draft'       },
  { value: 'onboarding',  label: 'Onboarding'  },
  { value: 'active',      label: 'Active'      },
  { value: 'forgiven',    label: 'Forgiven'    },
  { value: 'terminated',  label: 'Terminated'  },
  { value: 'collected',   label: 'Collected'   },
  { value: 'cancelled',   label: 'Cancelled'   },
]

const STATUS_STYLES = {
  draft:       'bg-slate-500/10 text-slate-400 border-slate-500/20',
  onboarding:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  active:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  forgiven:    'bg-brand-500/10 text-brand-400 border-brand-500/20',
  terminated:  'bg-red-500/10 text-red-400 border-red-500/20',
  collected:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  cancelled:   'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

const FILTER_OPTIONS = [
  { value: 'active',      label: 'Active'      },
  { value: 'all',         label: 'All'         },
  { value: 'draft',       label: 'Draft'       },
  { value: 'onboarding',  label: 'Onboarding'  },
  { value: 'forgiven',    label: 'Forgiven'    },
  { value: 'terminated',  label: 'Terminated'  },
]

const fmt     = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

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
function DownloadIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M2 12v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1"/></svg>
}

function exportCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = row[h] ?? ''
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    }).join(','))
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Form helpers ───────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', required, hint, prefix, suffix }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">
        {label}{required && <span className="text-brand-400 ml-0.5">*</span>}
      </label>
      <div className="flex">
        {prefix && <span className="flex items-center px-3 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-slate-400 text-sm shrink-0">{prefix}</span>}
        <input
          type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition
            ${prefix ? 'rounded-r-lg border-l-0' : suffix ? 'rounded-l-lg' : 'rounded-lg'}`}
        />
        {suffix && <span className="flex items-center px-3 bg-slate-700 border border-l-0 border-slate-600 rounded-r-lg text-slate-400 text-sm shrink-0">{suffix}</span>}
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
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition">
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
        <input type="checkbox" className="sr-only" checked={!!checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-9 h-5 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-700'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
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
// ── Milestone / installment row ────────────────────────────
function MilestoneRow({ index, data, onChange, onRemove, type }) {
  const set = (k, v) => onChange(index, { ...data, [k]: v })
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {type === 'retention' ? `Payment ${index + 1}` : `Milestone ${index + 1}`}
        </span>
        <button type="button" onClick={() => onRemove(index)} className="text-slate-500 hover:text-red-400 transition">
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {type === 'performance' && (
        <div>
          <label className="block text-slate-400 text-xs mb-1">Milestone Description</label>
          <input type="text" value={data.description ?? ''} onChange={e => set('description', e.target.value)}
            placeholder="e.g. Achieve 100 percent of annual production target"
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-slate-400 text-xs mb-1">{type === 'retention' ? 'Payment Date' : 'Measurement Date'}</label>
          <input type="date" value={data.date ?? ''} onChange={e => set('date', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition" />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Payout Amount</label>
          <div className="flex">
            <span className="flex items-center px-2 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-slate-400 text-xs shrink-0">$</span>
            <input type="number" value={data.amount ?? ''} onChange={e => set('amount', e.target.value)}
              placeholder="25000"
              className="w-full bg-slate-800 border border-l-0 border-slate-700 text-white placeholder-slate-500 rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition" />
          </div>
        </div>
      </div>

      {type === 'performance' && (
        <div>
          <label className="block text-slate-400 text-xs mb-1">Target Value (optional)</label>
          <input type="text" value={data.target_value ?? ''} onChange={e => set('target_value', e.target.value)}
            placeholder="e.g. 100%, $500K revenue, 95% patient satisfaction"
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition" />
        </div>
      )}
    </div>
  )
}

// ── Eligibility section (shared across all types) ──────────
function EligibilitySection({ form, set }) {
  return (
    <>
      <SectionLabel>Eligibility Criteria</SectionLabel>
      <p className="text-slate-500 text-xs -mt-2">Conditions the recipient must maintain. Displayed to the recipient in their portal.</p>
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
          hint="Must remain in the role this agreement was issued for"
        />
        <Toggle
          label="Licensure Required"
          checked={form.elig_licensure_required}
          onChange={v => set('elig_licensure_required', v)}
          hint="Must maintain active license or credentialing"
        />
      </div>
      <Field
        label="Minimum FTE"
        value={form.elig_min_fte} onChange={v => set('elig_min_fte', v)}
        type="number" placeholder="0.8"
        hint="e.g. 0.8 means must remain at or above 80 percent FTE"
      />
      <div>
        <label className="block text-slate-300 text-xs font-medium mb-1.5">Additional Eligibility Notes</label>
        <textarea value={form.elig_notes ?? ''} onChange={e => set('elig_notes', e.target.value)}
          placeholder="Any additional eligibility conditions specific to this agreement…"
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition resize-none" />
      </div>
    </>
  )
}

// ── Form: Signing Bonus (Promissory Note) ──────────────────
function SigningBonusForm({ form, set }) {
  const principal = parseFloat(form.principal_amount)
  const periods   = parseInt(form.forgiveness_periods)
  const preview   = amortPreview({
    principal,
    annualRatePct:        parseFloat(form.interest_rate) || 0,
    periods,
    frequency:            form.forgiveness_frequency,
    disbursementDate:     form.pn_dates_differ ? form.disbursement_date : form.execution_date,
    forgivenessStartDate: form.forgiveness_start_date,
  })

  const fmtD = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n ?? 0)
  const fmtS = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)

  return (
    <>
      <SectionLabel>Principal and Interest</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Principal Amount" required value={form.principal_amount} onChange={v => set('principal_amount', v)}
          type="number" prefix="$" placeholder="50000" />
        <Field label="Annual Interest Rate" required value={form.interest_rate} onChange={v => set('interest_rate', v)}
          type="number" suffix="%" placeholder="5.27" hint="Annual rate" />
      </div>
      <SelectField label="Interest Rate Type" required value={form.interest_rate_type}
        onChange={v => set('interest_rate_type', v)} options={INTEREST_RATE_TYPES} />

      <SectionLabel>Forgiveness Schedule</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Forgiveness Frequency" required value={form.forgiveness_frequency}
          onChange={v => set('forgiveness_frequency', v)} options={FORGIVENESS_FREQUENCIES} />
        <Field label="Number of Periods" required value={form.forgiveness_periods}
          onChange={v => set('forgiveness_periods', v)} type="number" placeholder="36"
          hint="Total number of forgiveness periods" />
      </div>

      {preview && principal > 0 && periods > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Schedule Preview</p>

          {/* Pre-forgiveness interest accrual */}
          {preview.preAccruedInterest > 0 && (
            <div className="mb-3 pb-3 border-b border-slate-700">
              <p className="text-xs font-semibold text-slate-400 mb-2">Pre-Forgiveness Period</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500 text-xs">Accrued Interest Before Start</p>
                  <p className="text-yellow-400 font-mono font-semibold">{fmtD(preview.preAccruedInterest)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Opening Balance at Forgiveness Start</p>
                  <p className="text-white font-mono font-semibold">{fmtD(preview.openingBalance)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Per-period breakdown */}
          <p className="text-xs font-semibold text-slate-400 mb-2">Per Period</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-slate-500 text-xs">Total Forgiven per Period — Taxable Income</p>
              <p className="text-brand-400 font-mono font-semibold">{fmtD(preview.fixedPayment)}</p>
              <p className="text-slate-600 text-xs">constant each period</p>
            </div>
            <div />
            <div>
              <p className="text-slate-500 text-xs">Forgiven Interest</p>
              <p className="text-white font-mono font-semibold">
                {fmtD(preview.period1ForgivenInterest)}
                {preview.lastPeriodForgivenInterest < preview.period1ForgivenInterest && (
                  <span className="text-slate-500 text-xs font-normal"> → {fmtD(preview.lastPeriodForgivenInterest)}</span>
                )}
              </p>
              <p className="text-slate-600 text-xs">decreases each period</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Forgiven Principal</p>
              <p className="text-white font-mono font-semibold">
                {fmtD(preview.period1ForgivenPrincipal)}
                {preview.lastPeriodForgivenPrincipal > preview.period1ForgivenPrincipal && (
                  <span className="text-slate-500 text-xs font-normal"> → {fmtD(preview.lastPeriodForgivenPrincipal)}</span>
                )}
              </p>
              <p className="text-slate-600 text-xs">increases each period</p>
            </div>
          </div>

          {/* Life of note totals */}
          <div className="border-t border-slate-700 pt-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-slate-500 text-xs">Total Principal Forgiven</p>
              <p className="text-white font-mono text-sm font-semibold">{fmtS(preview.totalForgivenPrincipal)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Total Interest Forgiven</p>
              <p className="text-white font-mono text-sm font-semibold">{fmtS(preview.totalForgivenInterest)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Total Taxable Income</p>
              <p className="text-brand-400 font-mono text-sm font-semibold">{fmtS(preview.totalForgiven)}</p>
            </div>
          </div>
        </div>
      )}

      <SectionLabel>Key Dates</SectionLabel>
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
        <Toggle
          label="Signing date differs from disbursement date"
          checked={form.pn_dates_differ}
          onChange={v => set('pn_dates_differ', v)}
          hint="Interest begins accruing from disbursement date — enable if the note was signed before funds were paid"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Execution Date" required value={form.execution_date}
            onChange={v => set('execution_date', v)} type="date" hint="Date the note was signed" />
          {form.pn_dates_differ && (
            <Field label="Disbursement Date" required value={form.disbursement_date}
              onChange={v => set('disbursement_date', v)} type="date" hint="Date funds were paid — interest accrues from here" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Effective Date" value={form.effective_date}
            onChange={v => set('effective_date', v)} type="date" hint="First day of employment" />
          <Field label="Forgiveness Start Date" required value={form.forgiveness_start_date}
            onChange={v => set('forgiveness_start_date', v)} type="date" hint="First forgiveness period begins" />
        </div>
      </div>

      <EligibilitySection form={form} set={set} />
    </>
  )
}

// ── Form: Starting Bonus ───────────────────────────────────
function StartingBonusForm({ form, set }) {
  const principal = parseFloat(form.principal_amount)
  const periods   = parseInt(form.forgiveness_periods)
  const forgivenPerPeriod = principal && periods ? principal / periods : null

  return (
    <>
      <SectionLabel>Bonus Amount</SectionLabel>
      <Field label="Bonus Amount" required value={form.principal_amount} onChange={v => set('principal_amount', v)}
        type="number" prefix="$" placeholder="10000" hint="Total amount paid via payroll" />

      <SectionLabel>Repayment Terms</SectionLabel>
      <p className="text-slate-500 text-xs -mt-2">If the recipient leaves before the repayment term ends, they owe a prorated portion back to the issuer.</p>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Forgiveness Frequency" required value={form.forgiveness_frequency}
          onChange={v => set('forgiveness_frequency', v)} options={FORGIVENESS_FREQUENCIES} />
        <Field label="Number of Periods" required value={form.forgiveness_periods}
          onChange={v => set('forgiveness_periods', v)} type="number" placeholder="12" hint="e.g. 12 months" />
      </div>

      {forgivenPerPeriod && principal > 0 && periods > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Repayment Preview</p>
          <div>
            <p className="text-slate-500 text-xs">Forgiven principal per period</p>
            <p className="text-white font-mono font-semibold">{fmt(forgivenPerPeriod)}</p>
          </div>
        </div>
      )}

      <SectionLabel>Key Dates</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Effective Date" value={form.effective_date}
          onChange={v => set('effective_date', v)} type="date" hint="First day of employment" />
        <Field label="Forgiveness Start Date" required value={form.forgiveness_start_date}
          onChange={v => set('forgiveness_start_date', v)} type="date" hint="When the repayment obligation begins" />
      </div>

      <EligibilitySection form={form} set={set} />
    </>
  )
}

// ── Form: Retention Bonus ──────────────────────────────────
function RetentionBonusForm({ form, set }) {
  const [installments, setInstallments] = useState(
    () => form.custom_terms?.installments?.length ? form.custom_terms.installments : [{ date: '', amount: '' }]
  )

  useEffect(() => {
    set('custom_terms', { ...form.custom_terms, installments })
  }, [installments])

  const update = (i, data) => setInstallments(p => p.map((item, idx) => idx === i ? data : item))
  const add    = ()        => setInstallments(p => [...p, { date: '', amount: '' }])
  const remove = i         => setInstallments(p => p.filter((_, idx) => idx !== i))
  const total  = installments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

  return (
    <>
      <SectionLabel>Payment Schedule</SectionLabel>
      <p className="text-slate-500 text-xs -mt-2">Define when payments are made and how much. The recipient must meet all eligibility criteria on each payment date to receive the payout.</p>

      <div className="flex flex-col gap-3">
        {installments.map((inst, i) => (
          <MilestoneRow key={i} index={i} data={inst} onChange={update} onRemove={remove} type="retention" />
        ))}
      </div>

      <button type="button" onClick={add}
        className="flex items-center gap-2 text-brand-400 hover:text-brand-300 text-sm font-medium transition">
        <PlusIcon className="w-4 h-4" /> Add Payment
      </button>

      {total > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-500 text-xs">Total bonus value</p>
          <p className="text-white font-mono font-semibold text-lg">{fmt(total)}</p>
        </div>
      )}

      <SectionLabel>Key Dates</SectionLabel>
      <Field label="Effective Date" value={form.effective_date}
        onChange={v => set('effective_date', v)} type="date" hint="Agreement start date" />

      <EligibilitySection form={form} set={set} />
    </>
  )
}

// ── Form: Performance Bonus ────────────────────────────────
function PerformanceBonusForm({ form, set }) {
  const [milestones, setMilestones] = useState(
    () => form.custom_terms?.milestones?.length
      ? form.custom_terms.milestones
      : [{ description: '', date: '', amount: '', target_value: '' }]
  )

  useEffect(() => {
    set('custom_terms', { ...form.custom_terms, milestones })
  }, [milestones])

  const update = (i, data) => setMilestones(p => p.map((item, idx) => idx === i ? data : item))
  const add    = ()        => setMilestones(p => [...p, { description: '', date: '', amount: '', target_value: '' }])
  const remove = i         => setMilestones(p => p.filter((_, idx) => idx !== i))
  const total  = milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0)

  return (
    <>
      <SectionLabel>Milestones and Payouts</SectionLabel>
      <p className="text-slate-500 text-xs -mt-2">Define each milestone and its corresponding payout. Each milestone is evaluated on the measurement date.</p>

      <div className="flex flex-col gap-3">
        {milestones.map((m, i) => (
          <MilestoneRow key={i} index={i} data={m} onChange={update} onRemove={remove} type="performance" />
        ))}
      </div>

      <button type="button" onClick={add}
        className="flex items-center gap-2 text-brand-400 hover:text-brand-300 text-sm font-medium transition">
        <PlusIcon className="w-4 h-4" /> Add Milestone
      </button>

      {total > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-500 text-xs">Total potential payout</p>
          <p className="text-white font-mono font-semibold text-lg">{fmt(total)}</p>
        </div>
      )}

      <SectionLabel>Key Dates</SectionLabel>
      <Field label="Effective Date" value={form.effective_date}
        onChange={v => set('effective_date', v)} type="date" hint="Agreement start date" />

      <EligibilitySection form={form} set={set} />
    </>
  )
}

// ── Form: Custom ───────────────────────────────────────────
function CustomBonusForm({ form, set }) {
  return (
    <>
      <SectionLabel>Agreement Details</SectionLabel>
      <Field label="Bonus Amount" required value={form.principal_amount} onChange={v => set('principal_amount', v)}
        type="number" prefix="$" placeholder="0" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Effective Date" value={form.effective_date}
          onChange={v => set('effective_date', v)} type="date" />
        <Field label="End Date" value={form.projected_end_date}
          onChange={v => set('projected_end_date', v)} type="date" />
      </div>
      <EligibilitySection form={form} set={set} />
    </>
  )
}

// ── US States ──────────────────────────────────────────────
const US_STATES = [
  {value:'AL',label:'Alabama'},{value:'AK',label:'Alaska'},{value:'AZ',label:'Arizona'},
  {value:'AR',label:'Arkansas'},{value:'CA',label:'California'},{value:'CO',label:'Colorado'},
  {value:'CT',label:'Connecticut'},{value:'DE',label:'Delaware'},{value:'FL',label:'Florida'},
  {value:'GA',label:'Georgia'},{value:'HI',label:'Hawaii'},{value:'ID',label:'Idaho'},
  {value:'IL',label:'Illinois'},{value:'IN',label:'Indiana'},{value:'IA',label:'Iowa'},
  {value:'KS',label:'Kansas'},{value:'KY',label:'Kentucky'},{value:'LA',label:'Louisiana'},
  {value:'ME',label:'Maine'},{value:'MD',label:'Maryland'},{value:'MA',label:'Massachusetts'},
  {value:'MI',label:'Michigan'},{value:'MN',label:'Minnesota'},{value:'MS',label:'Mississippi'},
  {value:'MO',label:'Missouri'},{value:'MT',label:'Montana'},{value:'NE',label:'Nebraska'},
  {value:'NV',label:'Nevada'},{value:'NH',label:'New Hampshire'},{value:'NJ',label:'New Jersey'},
  {value:'NM',label:'New Mexico'},{value:'NY',label:'New York'},{value:'NC',label:'North Carolina'},
  {value:'ND',label:'North Dakota'},{value:'OH',label:'Ohio'},{value:'OK',label:'Oklahoma'},
  {value:'OR',label:'Oregon'},{value:'PA',label:'Pennsylvania'},{value:'RI',label:'Rhode Island'},
  {value:'SC',label:'South Carolina'},{value:'SD',label:'South Dakota'},{value:'TN',label:'Tennessee'},
  {value:'TX',label:'Texas'},{value:'UT',label:'Utah'},{value:'VT',label:'Vermont'},
  {value:'VA',label:'Virginia'},{value:'WA',label:'Washington'},{value:'WV',label:'West Virginia'},
  {value:'WI',label:'Wisconsin'},{value:'WY',label:'Wyoming'},
]

// ── State law banner ───────────────────────────────────────
function StateLawBanner({ rules, acknowledged, onAcknowledge }) {
  const [expanded, setExpanded] = useState({})
  if (!rules || rules.length === 0) return null

  const LEVEL_STYLES = {
    warning: { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    icon: '⚠️', label: 'Warning' },
    caution: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: '⚡', label: 'Caution' },
    info:    { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   icon: 'ℹ️', label: 'Notice'  },
  }

  const topLevel = rules.reduce((top, r) => {
    const order = { warning: 0, caution: 1, info: 2 }
    return order[r.rule_level] < order[top] ? r.rule_level : top
  }, 'info')

  const style = LEVEL_STYLES[topLevel]

  return (
    <div className={`${style.bg} border ${style.border} rounded-xl p-4 flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{style.icon}</span>
        <p className={`text-xs font-bold uppercase tracking-widest ${style.text}`}>
          State Law {style.label}
        </p>
      </div>

      {rules.map((rule, i) => (
        <div key={i} className="flex flex-col gap-1">
          <p className="text-slate-200 text-sm font-medium">{rule.rule_summary}</p>
          {expanded[i] && (
            <div className="mt-1">
              <p className="text-slate-400 text-xs leading-relaxed">{rule.rule_detail}</p>
              {rule.source && <p className="text-slate-500 text-xs mt-1">Source: {rule.source}</p>}
            </div>
          )}
          <button type="button" onClick={() => setExpanded(e => ({ ...e, [i]: !e[i] }))}
            className={`text-xs font-medium ${style.text} hover:opacity-80 transition text-left`}>
            {expanded[i] ? 'Show less ▲' : 'Learn more ▼'}
          </button>
        </div>
      ))}

      <label className="flex items-start gap-3 cursor-pointer pt-1 border-t border-white/10">
        <div className="relative mt-0.5 shrink-0">
          <input type="checkbox" className="sr-only" checked={!!acknowledged} onChange={e => onAcknowledge(e.target.checked)} />
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${acknowledged ? 'bg-brand-600 border-brand-600' : 'border-slate-500 bg-slate-800'}`}>
            {acknowledged && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 5 4 8 9 2"/></svg>}
          </div>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">
          I have reviewed this state law notice and understand it may affect this agreement. I will consult legal counsel as appropriate.
        </p>
      </label>
    </div>
  )
}

// ── Agreement drawer ───────────────────────────────────────
const EMPTY_FORM = {
  bonus_type: 'signing_bonus', recipient_id: '', agreement_number: '',
  principal_amount: '', interest_rate: '', interest_rate_type: 'fixed',
  forgiveness_start_date: '', forgiveness_frequency: 'monthly', forgiveness_periods: '',
  execution_date: '', effective_date: '', projected_end_date: '',
  disbursement_date: '', pn_dates_differ: false,
  status: 'draft', notes: '', custom_terms: {},
  recipient_state: '',
  elig_min_fte: '', elig_benefits_eligible: false,
  elig_maintain_role: false, elig_licensure_required: false, elig_notes: '',
}

function AgreementDrawer({ issuerId, recipients, agreement, onClose, onSaved }) {
  const [form, setForm]     = useState(() => !agreement ? { ...EMPTY_FORM } : {
    ...EMPTY_FORM, ...agreement,
    pn_dates_differ:         !!agreement.custom_terms?.disbursement_date,
    disbursement_date:       agreement.custom_terms?.disbursement_date ?? '',
    elig_min_fte:            agreement.eligibility_criteria?.min_fte ?? '',
    elig_benefits_eligible:  agreement.eligibility_criteria?.benefits_eligible ?? false,
    elig_maintain_role:      agreement.eligibility_criteria?.maintain_role ?? false,
    elig_licensure_required: agreement.eligibility_criteria?.licensure_required ?? false,
    elig_notes:              agreement.eligibility_criteria?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [stateRules, setStateRules]           = useState([])
  const [stateLawAcknowledged, setStateLawAck] = useState(false)
  const isEdit              = !!agreement

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // Load state rules whenever state or bonus type changes
  useEffect(() => {
    async function loadRules() {
      if (!form.recipient_state || !form.bonus_type) { setStateRules([]); return }
      const { data } = await supabase
        .from('state_bonus_rules')
        .select('*')
        .or(`state_code.eq.${form.recipient_state},state_code.eq.ALL`)
        .or(`bonus_type.eq.${form.bonus_type},bonus_type.eq.all`)
        .order('rule_level')
      setStateRules(data ?? [])
      setStateLawAck(false)
    }
    loadRules()
  }, [form.recipient_state, form.bonus_type])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.recipient_id)   { setError('Please select a recipient.'); return }
    if (!form.bonus_type)     { setError('Please select a bonus type.'); return }
    if (stateRules.length > 0 && !stateLawAcknowledged) {
      setError('Please review and acknowledge the state law notice before saving.')
      return
    }

    setSaving(true)
    setError(null)

    const eligibility_criteria = {
      min_fte:            form.elig_min_fte ? parseFloat(form.elig_min_fte) : null,
      benefits_eligible:  form.elig_benefits_eligible,
      maintain_role:      form.elig_maintain_role,
      licensure_required: form.elig_licensure_required,
      notes:              form.elig_notes || null,
    }

    const custom_terms = { ...form.custom_terms }
    if (form.bonus_type === 'signing_bonus' && form.pn_dates_differ && form.disbursement_date) {
      custom_terms.disbursement_date = form.disbursement_date
    }

    const principal = parseFloat(form.principal_amount) || 0
    const periods   = parseInt(form.forgiveness_periods) || null

    const payload = {
      issuer_id:                    issuerId,
      recipient_id:                 form.recipient_id,
      bonus_type:                   form.bonus_type,
      agreement_number:             form.agreement_number || null,
      principal_amount:             principal,
      original_principal:           isEdit ? undefined : principal || null,
      outstanding_balance:          isEdit ? undefined : principal || null,
      interest_rate:                form.interest_rate ? parseFloat(form.interest_rate) : null,
      interest_rate_type:           form.interest_rate_type || null,
      forgiveness_start_date:       form.forgiveness_start_date || null,
      forgiveness_frequency:        form.forgiveness_frequency,
      forgiveness_periods:          periods,
      forgiveness_amount_per_period:principal && periods ? principal / periods : null,
      execution_date:               form.execution_date || null,
      effective_date:               form.effective_date || null,
      projected_end_date:           form.projected_end_date || null,
      status:                       form.status,
      notes:                        form.notes || null,
      recipient_state:              form.recipient_state || null,
      eligibility_criteria,
      custom_terms,
    }

    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

    let err, savedId
    if (isEdit) {
      ;({ error: err } = await supabase.from('agreements').update(payload).eq('id', agreement.id))
      savedId = agreement.id
    } else {
      const { data: inserted, error: insertErr } = await supabase.from('agreements').insert(payload).select('id').single()
      err     = insertErr
      savedId = inserted?.id
    }

    setSaving(false)
    if (err) { setError(err.message); return }

    // Fire amortization schedule generation for signing and starting bonuses
    if (savedId && ['signing_bonus', 'starting_bonus'].includes(form.bonus_type)) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        supabase.functions.invoke('generate-amortization', {
          body: { agreement_id: savedId },
          headers: { Authorization: `Bearer ${session?.access_token}` }
        }).catch(e => console.warn('Amortization generation failed:', e))
      })
    }

    onSaved()
  }

  const typeInfo = BONUS_TYPES.find(b => b.value === form.bonus_type)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col h-full">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-white font-semibold">{isEdit ? 'Edit Agreement' : 'New Agreement'}</h2>
            {typeInfo && <p className="text-slate-500 text-xs mt-0.5">{typeInfo.sub}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">

            {/* Shared header fields */}
            <SectionLabel>Agreement</SectionLabel>

            <SelectField label="Bonus Type" required value={form.bonus_type}
              onChange={v => set('bonus_type', v)}
              options={BONUS_TYPES.map(b => ({ value: b.value, label: b.label }))} />

            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5">
                Recipient<span className="text-brand-400 ml-0.5">*</span>
              </label>
              <select value={form.recipient_id} onChange={e => set('recipient_id', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition">
                <option value="">Select recipient…</option>
                {recipients.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.first_name} {r.last_name}{r.title ? ` — ${r.title}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-slate-500 text-xs mt-1">
                Not listed? <a href="/issuer/recipients" className="text-brand-400 hover:text-brand-300">Add them first →</a>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Agreement Number" value={form.agreement_number}
                onChange={v => set('agreement_number', v)} placeholder="Auto if left blank" />
              <SelectField label="Status" value={form.status}
                onChange={v => set('status', v)} options={AGREEMENT_STATUSES} />
            </div>

            <SelectField
              label="Recipient Work State"
              required
              value={form.recipient_state}
              onChange={v => set('recipient_state', v)}
              options={US_STATES}
              hint="State where the recipient will be employed — triggers state law review"
            />

            {/* State law banner */}
            {stateRules.length > 0 && (
              <StateLawBanner
                rules={stateRules}
                acknowledged={stateLawAcknowledged}
                onAcknowledge={setStateLawAck}
              />
            )}

            {/* Type-specific form */}
            {form.bonus_type === 'signing_bonus'     && <SigningBonusForm     form={form} set={set} />}
            {form.bonus_type === 'starting_bonus'    && <StartingBonusForm    form={form} set={set} />}
            {form.bonus_type === 'retention_bonus'   && <RetentionBonusForm   form={form} set={set} />}
            {form.bonus_type === 'performance_bonus' && <PerformanceBonusForm form={form} set={set} />}
            {form.bonus_type === 'custom'            && <CustomBonusForm      form={form} set={set} />}

            {/* Shared: internal notes */}
            <SectionLabel>Notes</SectionLabel>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5">Internal Notes</label>
              <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
                placeholder="Internal context about this agreement…" rows={3}
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition resize-none" />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}
          </div>

          <div className="shrink-0 px-5 py-4 border-t border-slate-800 flex gap-3 bg-slate-900">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium transition">
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
  const [viewing, setViewing]       = useState(null)
  const [filter, setFilter]         = useState('active')
  const [search, setSearch]         = useState('')
  const [sortCol, setSortCol]       = useState('effective_date')
  const [sortDir, setSortDir]       = useState('desc')

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortIcon(col) {
    if (sortCol !== col) return <span className="text-slate-600 ml-1">↕</span>
    return <span className="text-brand-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const load = useCallback(async () => {
    if (!issuerId) return
    setLoading(true)
    const [agRes, recRes] = await Promise.all([
      supabase
        .from('agreements')
        .select('*, recipients(id, first_name, last_name, title, first_login_at)')
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

  function exportAgreements() {
    const rows = filtered.map(a => ({
      'Recipient':         a.recipients ? `${a.recipients.first_name} ${a.recipients.last_name}` : '',
      'Agreement Number':  a.agreement_number ?? '',
      'Bonus Type':        BONUS_TYPES.find(b => b.value === a.bonus_type)?.label ?? a.bonus_type,
      'Status':            a.status,
      'Principal':         a.principal_amount,
      'Outstanding Balance': a.outstanding_balance,
      'Interest Rate':     a.interest_rate ?? '',
      'Forgiveness Periods': a.forgiveness_periods ?? '',
      'Forgiveness Frequency': a.forgiveness_frequency ?? '',
      'Effective Date':    a.effective_date ?? '',
      'Forgiveness Start': a.forgiveness_start_date ?? '',
      'Projected End':     a.projected_end_date ?? '',
    }))
    exportCSV(rows, `agreements-${filter}-${new Date().toISOString().split('T')[0]}.csv`)
  }

  const counts = AGREEMENT_STATUSES.reduce((acc, s) => {
    acc[s.value] = agreements.filter(a => a.status === s.value).length
    return acc
  }, { all: agreements.length })

  const filtered = agreements
    .filter(a => {
      const matchFilter = filter === 'all' ? true : a.status === filter
      const q           = search.toLowerCase()
      const name        = `${a.recipients?.first_name ?? ''} ${a.recipients?.last_name ?? ''}`.toLowerCase()
      const matchSearch = !q || name.includes(q) || a.agreement_number?.toLowerCase().includes(q)
      return matchFilter && matchSearch
    })
    .sort((a, b) => {
      let av, bv
      if (sortCol === 'recipient_name') {
        av = `${a.recipients?.last_name ?? ''} ${a.recipients?.first_name ?? ''}`
        bv = `${b.recipients?.last_name ?? ''} ${b.recipients?.first_name ?? ''}`
      } else { av = a[sortCol] ?? ''; bv = b[sortCol] ?? '' }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })

  const bonusLabel = t => BONUS_TYPES.find(b => b.value === t)?.label ?? t

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Agreements</h1>
          <p className="text-slate-400 text-sm mt-1">
            {counts.active} active · {counts.all} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          {filtered.length > 0 && (
            <button onClick={exportAgreements}
              className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
              <DownloadIcon className="w-4 h-4" /> Export
            </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition w-full sm:w-auto justify-center">
            <PlusIcon className="w-4 h-4" /> New Agreement
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
      )}

      {agreements.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by recipient name or agreement number…"
            className="flex-1 bg-slate-900 border border-slate-800 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition" />
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 flex-wrap">
            {FILTER_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setFilter(o.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${filter === o.value ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {o.label} {counts[o.value] > 0 && <span className="ml-1 opacity-60">{counts[o.value]}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

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
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition select-none" onClick={() => toggleSort('recipient_name')}>Recipient{sortIcon('recipient_name')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition select-none" onClick={() => toggleSort('bonus_type')}>Type{sortIcon('bonus_type')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition select-none" onClick={() => toggleSort('principal_amount')}>Principal{sortIcon('principal_amount')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition select-none" onClick={() => toggleSort('outstanding_balance')}>Outstanding{sortIcon('outstanding_balance')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition select-none" onClick={() => toggleSort('effective_date')}>Effective{sortIcon('effective_date')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 transition select-none" onClick={() => toggleSort('status')}>Status{sortIcon('status')}</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition cursor-pointer" onClick={() => setViewing(a)}>
                    <td className="px-5 py-3.5">
                      <p className="text-brand-400 hover:text-brand-300 font-medium transition">
                        {a.recipients ? `${a.recipients.first_name} ${a.recipients.last_name}` : '—'}
                      </p>
                      {a.agreement_number && <p className="text-slate-500 text-xs mt-0.5">No. {a.agreement_number}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{bonusLabel(a.bonus_type)}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono">{fmt(a.principal_amount)}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono">{fmt(a.outstanding_balance)}</td>
                    <td className="px-5 py-3.5 text-slate-400">{fmtDate(a.effective_date)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLES[a.status] ?? STATUS_STYLES.draft}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(a)}
                        className="text-xs font-medium text-slate-400 hover:text-white transition px-2 py-1 rounded hover:bg-slate-700">
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

      {viewing && (
        <AgreementDetailPanel
          agreement={viewing}
          onClose={() => setViewing(null)}
          onEdit={a => { setViewing(null); openEdit(a) }}
        />
      )}
    </div>
  )
}

// ── Agreement detail panel ─────────────────────────────────
function AgreementDetailPanel({ agreement: a, onClose, onEdit }) {
  const fmt     = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
  const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
  const fmtShort = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const elig    = a.eligibility_criteria ?? {}

  const [schedule, setSchedule]         = useState(null)
  const [schedLoading, setSchedLoading] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)

  const principal   = parseFloat(a.principal_amount) || 0
  const outstanding = parseFloat(a.outstanding_balance) ?? principal
  const forgiven    = principal - outstanding
  const pct         = principal > 0 ? Math.round((forgiven / principal) * 100) : 0
  const isPN        = a.bonus_type === 'signing_bonus'
  const isStarting  = a.bonus_type === 'starting_bonus'
  const isRetention = a.bonus_type === 'retention_bonus'
  const isPerf      = a.bonus_type === 'performance_bonus'

  async function loadSchedule() {
    if (schedule) { setShowSchedule(s => !s); return }
    setSchedLoading(true)
    setShowSchedule(true)
    const { data } = await supabase
      .from('amortization_schedule')
      .select('period_number, period_start_date, beginning_balance, interest_amount, forgiveness_amount, imputed_income, ending_balance, is_processed')
      .eq('agreement_id', a.id)
      .order('period_number')
    setSchedule(data ?? [])
    setSchedLoading(false)
  }

  function Row({ label, value }) {
    return value ? (
      <div>
        <p className="text-slate-500 text-xs mb-0.5">{label}</p>
        <p className="text-slate-200 text-sm">{value}</p>
      </div>
    ) : null
  }

  function Section({ title, children }) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{title}</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>
        {children}
      </div>
    )
  }

  const FREQ = { biweekly: 'Biweekly', semi_monthly: 'Semi-Monthly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual', custom: 'Custom' }
  const RATE_TYPES = { fixed: 'Fixed', afr_short: 'AFR Short-Term', afr_mid: 'AFR Mid-Term', prime_based: 'Prime-Based', zero: 'Zero Percent' }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col h-full">

        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-white font-semibold">
              {a.recipients ? `${a.recipients.first_name} ${a.recipients.last_name}` : 'Agreement'}
            </h2>
            <p className="text-slate-400 text-sm mt-0.5">{BONUS_TYPES.find(b => b.value === a.bonus_type)?.label ?? a.bonus_type}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1 mt-0.5">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

          {/* Status + agreement number */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${STATUS_STYLES[a.status] ?? STATUS_STYLES.draft}`}>
              {a.status}
            </span>
            {a.agreement_number && (
              <span className="text-slate-500 text-xs">No. {a.agreement_number}</span>
            )}
          </div>

          {/* Balance — signing + starting */}
          {(isPN || isStarting) && (
            <Section title="Balance">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Principal</p>
                  <p className="text-white font-mono font-semibold">{fmt(principal)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Forgiven</p>
                  <p className="text-emerald-400 font-mono font-semibold">{fmt(forgiven)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Outstanding</p>
                  <p className="text-white font-mono font-semibold">{fmt(outstanding)}</p>
                </div>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-slate-500 text-xs">{pct}% forgiven</p>
            </Section>
          )}

          {/* Financial terms */}
          <Section title="Financial Terms">
            <div className="grid grid-cols-2 gap-3">
              <Row label="Principal Amount"    value={fmt(a.principal_amount)} />
              {a.interest_rate && <Row label="Interest Rate" value={`${a.interest_rate}% ${RATE_TYPES[a.interest_rate_type] ?? ''}`} />}
              {a.forgiveness_frequency && <Row label="Forgiveness Frequency" value={FREQ[a.forgiveness_frequency]} />}
              {a.forgiveness_periods   && <Row label="Forgiveness Periods"   value={`${a.forgiveness_periods} periods`} />}
              {a.forgiveness_amount_per_period && <Row label="Per Period" value={fmt(a.forgiveness_amount_per_period)} />}
            </div>
          </Section>

          {/* Amortization schedule */}
          {(isPN || isStarting) && (
            <Section title="Forgiveness Schedule">
              <button onClick={loadSchedule}
                className="flex items-center gap-2 text-brand-400 hover:text-brand-300 text-xs font-medium transition mb-2">
                {showSchedule ? '▲ Hide Schedule' : '▼ View Full Schedule'}
              </button>
              {showSchedule && (
                schedLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                  </div>
                ) : schedule && schedule.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-700 mt-2">
                    <table className="w-full text-xs min-w-[500px]">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-500 uppercase tracking-wide">
                          <th className="text-left px-3 py-2 font-medium">#</th>
                          <th className="text-left px-3 py-2 font-medium">Date</th>
                          <th className="text-right px-3 py-2 font-medium">Opening</th>
                          <th className="text-right px-3 py-2 font-medium">Principal</th>
                          <th className="text-right px-3 py-2 font-medium">Interest</th>
                          <th className="text-right px-3 py-2 font-medium">Total</th>
                          <th className="text-right px-3 py-2 font-medium">Closing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {schedule.map(row => (
                          <tr key={row.period_number} className={row.is_processed ? 'opacity-50' : ''}>
                            <td className="px-3 py-2 text-slate-400">
                              {row.period_number}
                              {row.is_processed && <span className="ml-1 text-emerald-500">✓</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-300">{fmtShort(row.period_start_date)}</td>
                            <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(row.beginning_balance)}</td>
                            <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(row.forgiveness_amount)}</td>
                            <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(row.interest_amount)}</td>
                            <td className="px-3 py-2 text-right text-brand-400 font-mono font-semibold">{fmt(row.imputed_income)}</td>
                            <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(row.ending_balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-slate-700 bg-slate-800/40">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-slate-400 text-xs font-semibold">Totals</td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono font-semibold">{fmt(schedule.reduce((s, r) => s + parseFloat(r.forgiveness_amount), 0))}</td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono font-semibold">{fmt(schedule.reduce((s, r) => s + parseFloat(r.interest_amount), 0))}</td>
                          <td className="px-3 py-2 text-right text-brand-400 font-mono font-semibold">{fmt(schedule.reduce((s, r) => s + parseFloat(r.imputed_income), 0))}</td>
                          <td className="px-3 py-2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-600 text-xs italic mt-2">No schedule generated yet. Save the agreement to generate.</p>
                )
              )}
            </Section>
          )}

          {/* Retention payments */}
          {isRetention && a.custom_terms?.installments?.length > 0 && (
            <Section title="Payment Schedule">
              <div className="flex flex-col gap-2">
                {a.custom_terms.installments.map((inst, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg">
                    <span className="text-slate-300 text-sm">{inst.date ? new Date(inst.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                    <span className="text-white font-mono text-sm font-semibold">{fmt(inst.amount)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Performance milestones */}
          {isPerf && a.custom_terms?.milestones?.length > 0 && (
            <Section title="Milestones">
              <div className="flex flex-col gap-2">
                {a.custom_terms.milestones.map((m, i) => (
                  <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-slate-300 text-sm">{m.description || `Milestone ${i + 1}`}</span>
                      <span className="text-white font-mono text-sm font-semibold">{fmt(m.amount)}</span>
                    </div>
                    {m.target_value && <p className="text-slate-500 text-xs">Target: {m.target_value}</p>}
                    {m.date && <p className="text-slate-500 text-xs">{new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Key dates */}
          <Section title="Key Dates">
            <div className="grid grid-cols-2 gap-3">
              <Row label="Execution Date"      value={fmtDate(a.execution_date)} />
              <Row label="Effective Date"       value={fmtDate(a.effective_date)} />
              <Row label="Forgiveness Start"    value={fmtDate(a.forgiveness_start_date)} />
              <Row label="Projected End"        value={fmtDate(a.projected_end_date)} />
              {a.recipient_state && <Row label="Work State" value={US_STATES.find(s => s.value === a.recipient_state)?.label ?? a.recipient_state} />}
            </div>
          </Section>

          {/* Recipient acknowledgment */}
          <Section title="Recipient Review Period">
            {(() => {
              const execDate      = a.execution_date ? new Date(a.execution_date + 'T00:00:00') : null
              const firstLogin    = a.recipients?.first_login_at ? new Date(a.recipients.first_login_at) : null
              const acknowledged  = a.acknowledged_at ? new Date(a.acknowledged_at) : null

              function bizDays(start, end) {
                if (!start || !end) return null
                let count = 0
                const cur = new Date(start)
                cur.setDate(cur.getDate() + 1)
                while (cur <= end) {
                  const day = cur.getDay()
                  if (day !== 0 && day !== 6) count++
                  cur.setDate(cur.getDate() + 1)
                }
                return count
              }

              const daysToLogin  = bizDays(execDate, firstLogin)
              const daysToAck    = bizDays(execDate, acknowledged)

              return (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-slate-500 text-xs mb-0.5">Execution Date</p>
                      <p className="text-slate-200 text-sm">{execDate ? fmtDate(a.execution_date) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-0.5">First Portal Access</p>
                      {firstLogin
                        ? <p className="text-slate-200 text-sm">{firstLogin.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        : <p className="text-slate-600 text-sm italic">Not yet accessed</p>
                      }
                    </div>
                    {daysToLogin !== null && (
                      <div>
                        <p className="text-slate-500 text-xs mb-0.5">Business Days to First Access</p>
                        <p className="text-slate-200 text-sm font-semibold">{daysToLogin} business day{daysToLogin !== 1 ? 's' : ''}</p>
                      </div>
                    )}
                    {daysToAck !== null && (
                      <div>
                        <p className="text-slate-500 text-xs mb-0.5">Business Days to Acknowledgment</p>
                        <p className="text-slate-200 text-sm font-semibold">{daysToAck} business day{daysToAck !== 1 ? 's' : ''}</p>
                      </div>
                    )}
                  </div>

                  {acknowledged ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="2 8 6 12 14 4"/></svg>
                        <p className="text-emerald-400 text-xs font-semibold">Acknowledged</p>
                      </div>
                      <p className="text-slate-300 text-sm">
                        {acknowledged.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        {' at '}
                        {acknowledged.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                      <p className="text-slate-500 text-sm italic">Not yet acknowledged by recipient</p>
                    </div>
                  )}

                  <p className="text-slate-600 text-xs">Business days calculated Mon–Fri. Federal holidays not excluded.</p>
                </div>
              )
            })()}
          </Section>

          {/* Eligibility */}
          {(elig.benefits_eligible || elig.maintain_role || elig.licensure_required || elig.min_fte || elig.notes) && (
            <Section title="Eligibility Criteria">
              <div className="flex flex-wrap gap-2 mb-2">
                {elig.benefits_eligible  && <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">Benefits Eligible</span>}
                {elig.maintain_role      && <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">Maintain Role</span>}
                {elig.licensure_required && <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">Active Licensure</span>}
                {elig.min_fte            && <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">Min {Math.round(elig.min_fte * 100)}% FTE</span>}
              </div>
              {elig.notes && <p className="text-slate-400 text-sm leading-relaxed">{elig.notes}</p>}
            </Section>
          )}

          {/* DocuSign status */}
          {(isPN || isStarting) && (
            <Section title="Document Execution">
              {a.docusign_envelope_id ? (
                <div className="flex flex-col gap-2">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    a.docusign_status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20' :
                    a.docusign_status === 'sent'      ? 'bg-yellow-500/10 border-yellow-500/20' :
                    'bg-slate-800 border-slate-700'
                  }`}>
                    <svg className={`w-3.5 h-3.5 ${a.docusign_status === 'completed' ? 'text-emerald-400' : 'text-yellow-400'}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M10 2v3h3"/><path d="M5 7h6M5 10h4"/></svg>
                    <p className={`text-sm font-medium capitalize ${a.docusign_status === 'completed' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      DocuSign: {a.docusign_status ?? 'Sent'}
                    </p>
                  </div>
                  {a.sent_for_signature_at && (
                    <p className="text-slate-500 text-xs">
                      Sent {new Date(a.sent_for_signature_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  {a.signed_document_url && (
                    <a href={a.signed_document_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 text-xs font-medium transition">
                      View Signed Document →
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-slate-500 text-sm italic">Document not yet sent for signature.</p>
                  <p className="text-slate-600 text-xs">Configure DocuSign in Settings to enable electronic signature.</p>
                </div>
              )}
            </Section>
          )}

          {/* Notes */}
          {a.notes && (
            <div>
              <p className="text-slate-500 text-xs mb-1">Internal Notes</p>
              <p className="text-slate-300 text-sm leading-relaxed">{a.notes}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-slate-800 flex flex-col gap-2">
          {/* Send for Signature — shown when DocuSign is configured and not yet sent */}
          {(isPN || isStarting) && !a.docusign_envelope_id && ['draft', 'onboarding'].includes(a.status) && (
            <button
              onClick={() => alert('DocuSign integration coming soon. Configure your DocuSign credentials in Settings to enable.')}
              className="w-full py-2.5 rounded-lg border border-brand-600 text-brand-400 hover:bg-brand-600/10 text-sm font-medium transition flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M10 2v3h3"/><path d="M5 7h6M5 10h4"/></svg>
              Send for Signature
            </button>
          )}
          <button onClick={() => onEdit(a)}
            className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition">
            Edit Agreement
          </button>
        </div>
      </div>
    </div>
  )
}
