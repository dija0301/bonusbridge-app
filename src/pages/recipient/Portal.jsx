import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { estimateBalanceAtDate } from '../../lib/amortization'
import RecipientOnboarding from './Onboarding'

// ── Helpers ────────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
const fmtDateShort = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const BONUS_TYPE_LABELS = {
  signing_bonus:     'Signing Bonus — Promissory Note',
  starting_bonus:    'Starting Bonus',
  retention_bonus:   'Retention Bonus',
  performance_bonus: 'Performance Bonus',
  custom:            'Custom Agreement',
}

const FREQ_LABELS = {
  biweekly: 'Biweekly', semi_monthly: 'Semi-Monthly', monthly: 'Monthly',
  quarterly: 'Quarterly', annual: 'Annual', custom: 'Custom',
}

// ── Icons ──────────────────────────────────────────────────
function CheckIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="2 8 6 12 14 4"/></svg>
}
function EditIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>
}

// ── Progress bar ───────────────────────────────────────────
function ProgressBar({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct || 0))
  return (
    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
      <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${clamped}%` }} />
    </div>
  )
}

// ── Eligibility pill ───────────────────────────────────────
function EligPill({ label }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs font-medium">
      <CheckIcon className="w-3 h-3" />
      {label}
    </div>
  )
}

// ── Balance estimator ──────────────────────────────────────
function BalanceEstimator({ agreement }) {
  const [date, setDate]         = useState('')
  const [result, setResult]     = useState(null)

  function calculate() {
    if (!date) return
    const est = estimateBalanceAtDate(agreement, date)
    setResult(est)
  }

  const fmtD = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n ?? 0)

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5">
      <h4 className="text-white font-semibold mb-1">Repayment Estimator</h4>
      <p className="text-slate-400 text-sm mb-4">Enter a hypothetical departure date to estimate your repayment obligation. This is an estimate only — your actual amount is determined by your employer and may differ based on final calculations.</p>
      <div className="flex gap-3 mb-4">
        <input type="date" value={date} onChange={e => { setDate(e.target.value); setResult(null) }}
          className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition" />
        <button onClick={calculate} disabled={!date}
          className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-medium transition">
          Estimate
        </button>
      </div>
      {result !== null && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="text-center mb-4">
            <p className="text-slate-400 text-sm mb-1">Estimated repayment obligation</p>
            <p className={`text-3xl font-bold font-mono mb-1 ${result.balance === 0 ? 'text-emerald-400' : 'text-white'}`}>
              {fmtD(result.balance)}
            </p>
            {result.balance === 0
              ? <p className="text-emerald-400 text-sm">Fully forgiven by this date</p>
              : null
            }
          </div>
          {result.balance > 0 && (
            <div className="border-t border-slate-700 pt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-500 mb-0.5">Periods Completed</p>
                <p className="text-slate-200 font-mono">{result.periodsElapsed} of {agreement.forgiveness_periods}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Total Forgiven to Date</p>
                <p className="text-emerald-400 font-mono">{fmtD(result.forgivenToDate)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500 text-xs mt-2 leading-relaxed">This estimate includes principal and accrued interest. Actual amounts are subject to review and confirmation by your employer. Interest calculations and other adjustments may apply.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Agreement card ─────────────────────────────────────────
function AgreementCard({ agreement }) {
  const [expanded, setExpanded]   = useState(false)
  const [schedule, setSchedule]   = useState(null)
  const [schedLoading, setSchedLoading] = useState(false)

  async function loadSchedule() {
    if (schedule) return // already loaded
    setSchedLoading(true)
    const { data } = await supabase
      .from('amortization_schedule')
      .select('period_number, period_start_date, beginning_balance, interest_amount, forgiveness_amount, imputed_income, ending_balance, is_processed')
      .eq('agreement_id', agreement.id)
      .order('period_number')
    setSchedule(data ?? [])
    setSchedLoading(false)
  }

  function handleExpand() {
    const newExpanded = !expanded
    setExpanded(newExpanded)
    if (newExpanded && (isPN || isStarting)) loadSchedule()
  }
  const principal    = parseFloat(agreement.principal_amount) || 0
  const outstanding  = parseFloat(agreement.outstanding_balance) ?? principal
  const forgiven     = principal - outstanding
  const pct          = principal > 0 ? (forgiven / principal) * 100 : 0
  const elig         = agreement.eligibility_criteria ?? {}
  const isPN         = agreement.bonus_type === 'signing_bonus'
  const isStarting   = agreement.bonus_type === 'starting_bonus'
  const isRetention  = agreement.bonus_type === 'retention_bonus'
  const isPerf       = agreement.bonus_type === 'performance_bonus'

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
              {BONUS_TYPE_LABELS[agreement.bonus_type] ?? agreement.bonus_type}
            </p>
            {agreement.agreement_number && <p className="text-slate-500 text-xs">No. {agreement.agreement_number}</p>}
          </div>
          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${
            agreement.status === 'active'   ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' :
            agreement.status === 'forgiven' ? 'bg-brand-500/15 text-brand-400 border-brand-500/25' :
            'bg-slate-500/15 text-slate-400 border-slate-500/25'
          }`}>{agreement.status}</span>
        </div>

        {/* Signing + Starting — balance and progress */}
        {(isPN || isStarting) && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <p className="text-slate-400 text-xs mb-1">Original</p>
                <p className="text-white text-xl font-bold font-mono">{fmt(principal)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Forgiven</p>
                <p className="text-emerald-400 text-xl font-bold font-mono">{fmt(forgiven)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Outstanding</p>
                <p className="text-white text-xl font-bold font-mono">{fmt(outstanding)}</p>
              </div>
            </div>
            <div className="mb-1.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-xs">Forgiveness Progress</span>
                <span className="text-slate-300 text-xs font-semibold">{Math.round(pct)}%</span>
              </div>
              <ProgressBar pct={pct} />
            </div>
            {agreement.forgiveness_frequency && agreement.forgiveness_periods && (
              <p className="text-slate-500 text-xs mt-2">
                {FREQ_LABELS[agreement.forgiveness_frequency]} · {agreement.forgiveness_periods} periods
                {agreement.forgiveness_amount_per_period ? ` · ${fmt(agreement.forgiveness_amount_per_period)} per period` : ''}
              </p>
            )}
          </>
        )}

        {/* Retention — payment schedule */}
        {isRetention && agreement.custom_terms?.installments?.length > 0 && (
          <div>
            <p className="text-slate-400 text-xs mb-3">Payment Schedule</p>
            <div className="flex flex-col gap-2">
              {agreement.custom_terms.installments.map((inst, i) => {
                const isPast = inst.date && new Date(inst.date + 'T00:00:00') < new Date()
                return (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${isPast ? 'bg-emerald-500/10 border-emerald-500/15' : 'bg-slate-800/60 border-slate-700'}`}>
                    <span className={`text-sm ${isPast ? 'text-emerald-400' : 'text-slate-300'}`}>{fmtDateShort(inst.date)}</span>
                    <span className="text-white font-mono text-sm font-semibold">{fmt(inst.amount)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Performance — milestones */}
        {isPerf && agreement.custom_terms?.milestones?.length > 0 && (
          <div>
            <p className="text-slate-400 text-xs mb-3">Milestones</p>
            <div className="flex flex-col gap-2">
              {agreement.custom_terms.milestones.map((m, i) => (
                <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-slate-300 text-sm">{m.description || `Milestone ${i + 1}`}</span>
                    <span className="text-white font-mono text-sm font-semibold">{fmt(m.amount)}</span>
                  </div>
                  {m.target_value && <p className="text-slate-500 text-xs">Target: {m.target_value}</p>}
                  {m.date && <p className="text-slate-500 text-xs">Measurement: {fmtDateShort(m.date)}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expandable details */}
      <div className="border-t border-white/8">
        <button onClick={handleExpand}
          className="w-full px-6 py-3 flex items-center justify-between text-slate-400 hover:text-white text-sm transition">
          <span>Agreement Details, Eligibility and Schedule</span>
          <span className="text-xs">{expanded ? '▲' : '▼'}</span>
        </button>

        {expanded && (
          <div className="px-6 pb-6 flex flex-col gap-5">
            {/* Key dates */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Key Dates</p>
              <div className="grid grid-cols-2 gap-3">
                {agreement.execution_date      && <DateRow label="Execution Date"      value={fmtDate(agreement.execution_date)} />}
                {agreement.effective_date      && <DateRow label="Effective Date"       value={fmtDate(agreement.effective_date)} />}
                {agreement.forgiveness_start_date && <DateRow label="Forgiveness Start" value={fmtDate(agreement.forgiveness_start_date)} />}
                {agreement.projected_end_date  && <DateRow label="Projected End"        value={fmtDate(agreement.projected_end_date)} />}
              </div>
            </div>

            {/* Eligibility */}
            {(elig.benefits_eligible || elig.maintain_role || elig.licensure_required || elig.min_fte || elig.notes) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Eligibility Requirements</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {elig.benefits_eligible  && <EligPill label="Benefits Eligible" />}
                  {elig.maintain_role      && <EligPill label="Maintain Role" />}
                  {elig.licensure_required && <EligPill label="Active Licensure" />}
                  {elig.min_fte            && <EligPill label={`Min ${Math.round(elig.min_fte * 100)}% FTE`} />}
                </div>
                {elig.notes && <p className="text-slate-400 text-sm leading-relaxed">{elig.notes}</p>}
              </div>
            )}

            {/* Amortization schedule */}
            {(isPN || isStarting) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Forgiveness Schedule</p>
                <p className="text-slate-500 text-xs mb-3">Full period-by-period breakdown. Total forgiven each period (principal + interest) is reported to payroll as taxable income.</p>
                {schedLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                  </div>
                ) : schedule && schedule.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-700">
                    <table className="w-full text-xs min-w-[520px]">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-500 uppercase tracking-wide">
                          <th className="text-left px-3 py-2.5 font-medium">Period</th>
                          <th className="text-left px-3 py-2.5 font-medium">Date</th>
                          <th className="text-right px-3 py-2.5 font-medium">Opening Balance</th>
                          <th className="text-right px-3 py-2.5 font-medium">Forgiven Principal</th>
                          <th className="text-right px-3 py-2.5 font-medium">Forgiven Interest</th>
                          <th className="text-right px-3 py-2.5 font-medium">Total Forgiven</th>
                          <th className="text-right px-3 py-2.5 font-medium">Closing Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {schedule.map(row => {
                          const isProcessed = row.is_processed
                          const today = new Date()
                          const rowDate = new Date(row.period_start_date)
                          const isCurrent = !isProcessed && rowDate <= today
                          return (
                            <tr key={row.period_number} className={`${isProcessed ? 'opacity-50' : ''} ${isCurrent ? 'bg-brand-500/5' : ''}`}>
                              <td className="px-3 py-2 text-slate-400">
                                {row.period_number}
                                {isProcessed && <span className="ml-1 text-emerald-500">✓</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-300">{fmtDateShort(row.period_start_date)}</td>
                              <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(row.beginning_balance)}</td>
                              <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(row.forgiveness_amount)}</td>
                              <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(row.interest_amount)}</td>
                              <td className="px-3 py-2 text-right text-brand-400 font-mono font-semibold">{fmt(row.imputed_income)}</td>
                              <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(row.ending_balance)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="border-t border-slate-700 bg-slate-800/40">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-slate-400 text-xs font-semibold">Totals</td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono font-semibold">
                            {fmt(schedule.reduce((s, r) => s + parseFloat(r.forgiveness_amount), 0))}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono font-semibold">
                            {fmt(schedule.reduce((s, r) => s + parseFloat(r.interest_amount), 0))}
                          </td>
                          <td className="px-3 py-2 text-right text-brand-400 font-mono font-semibold">
                            {fmt(schedule.reduce((s, r) => s + parseFloat(r.imputed_income), 0))}
                          </td>
                          <td className="px-3 py-2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-600 text-sm italic">Schedule not yet generated. Contact your HR team.</p>
                )}
              </div>
            )}

            {/* Balance estimator */}
            {(isPN || isStarting) && agreement.status === 'active' && (
              <BalanceEstimator agreement={agreement} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DateRow({ label, value }) {
  return (
    <div>
      <p className="text-slate-500 text-xs mb-0.5">{label}</p>
      <p className="text-slate-200 text-sm">{value}</p>
    </div>
  )
}

// ── Contact editor ─────────────────────────────────────────
function ContactEditor({ recipient, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({
    personal_email: recipient.personal_email ?? '',
    mobile_phone:   recipient.mobile_phone ?? '',
    address_line1:  recipient.address_line1 ?? '',
    address_line2:  recipient.address_line2 ?? '',
    city:           recipient.city ?? '',
    state:          recipient.state ?? '',
    zip:            recipient.zip ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [saved, setSaved]   = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const changed = Object.entries(form).filter(([k, v]) => v !== (recipient[k] ?? ''))
    const { error: updateErr } = await supabase.from('recipients').update(form).eq('id', recipient.id)
    if (updateErr) { setError(updateErr.message); setSaving(false); return }
    for (const [field, newVal] of changed) {
      await supabase.from('recipient_events').insert({
        recipient_id: recipient.id, issuer_id: recipient.issuer_id,
        event_type: 'contact_update', field_changed: field,
        old_value: recipient[field] ?? null, new_value: newVal,
      })
    }
    setSaving(false); setSaved(true); setEditing(false)
    setTimeout(() => setSaved(false), 3000)
    onSaved()
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-white font-semibold">Your Contact Information</h3>
        <div className="flex items-center gap-3">
          {saved && <span className="text-emerald-400 text-xs font-medium">Saved</span>}
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 text-sm font-medium transition">
              <EditIcon className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>
      </div>

      {!editing ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <InfoRow label="Work Email"     value={recipient.email} />
            <InfoRow label="Personal Email" value={recipient.personal_email} />
            <InfoRow label="Mobile Phone"   value={recipient.mobile_phone} />
            <InfoRow label="Work Phone"     value={recipient.work_phone} />
          </div>
          <InfoRow label="Mailing Address"
            value={[recipient.address_line1, recipient.address_line2, recipient.city, recipient.state, recipient.zip].filter(Boolean).join(', ')} />
          <p className="text-slate-600 text-xs mt-3">Keep your personal email and mobile current — these are used to contact you after any employment changes.</p>
        </>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <p className="text-slate-400 text-sm -mt-2">Keep your personal contact information current — especially your personal email and mobile number.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditField label="Personal Email" type="email" value={form.personal_email} onChange={v => set('personal_email', v)} placeholder="your@personal.com" />
            <EditField label="Mobile Phone"   type="tel"   value={form.mobile_phone}   onChange={v => set('mobile_phone', v)}   placeholder="(612) 555-0101" />
          </div>
          <EditField label="Address Line 1" value={form.address_line1} onChange={v => set('address_line1', v)} placeholder="123 Main St" />
          <EditField label="Address Line 2" value={form.address_line2} onChange={v => set('address_line2', v)} placeholder="Apt, Suite…" />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1"><EditField label="City"  value={form.city}  onChange={v => set('city', v)}  placeholder="Minneapolis" /></div>
            <EditField label="State" value={form.state} onChange={v => set('state', v)} placeholder="MN" />
            <EditField label="ZIP"   value={form.zip}   onChange={v => set('zip', v)}   placeholder="55401" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditing(false)}
              className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium transition">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-slate-500 text-xs mb-0.5">{label}</p>
      <p className="text-slate-200 text-sm">{value || <span className="text-slate-600 italic">Not provided</span>}</p>
    </div>
  )
}

function EditField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition" />
    </div>
  )
}

// ── Main portal ────────────────────────────────────────────
export default function RecipientPortal() {
  const { session } = useAuth()
  const [recipient, setRecipient]   = useState(null)
  const [agreements, setAgreements] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => { if (session?.user?.id) load() }, [session])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // Fetch ALL recipient records for this user (may span multiple orgs)
      const { data: recs, error: recErr } = await supabase
        .from('recipients').select('*').eq('user_id', session.user.id).order('created_at')
      if (recErr || !recs?.length) throw new Error('Could not find your recipient profile. Please contact your administrator.')

      // Use the first (oldest) recipient as primary for contact info display
      const primaryRec = recs[0]
      setRecipient(primaryRec)

      // Check if ANY recipient record needs onboarding
      const needsOnboarding = recs.some(r => !r.onboarding_complete)
      if (needsOnboarding) {
        setShowOnboarding(true)
        setLoading(false)
        return
      }

      // Log last login on all recipient records
      const now = new Date().toISOString()
      for (const rec of recs) {
        const loginUpdates = { last_login_at: now }
        if (!rec.first_login_at) loginUpdates.first_login_at = now
        await supabase.from('recipients').update(loginUpdates).eq('id', rec.id)
        await supabase.from('recipient_events').insert({ recipient_id: rec.id, issuer_id: rec.issuer_id, event_type: 'login' })
      }

      // Fetch ALL agreements across all recipient records
      const recipientIds = recs.map(r => r.id)
      const { data: ags, error: agErr } = await supabase
        .from('agreements').select('*')
        .in('recipient_id', recipientIds)
        .order('created_at', { ascending: false })
      if (agErr) throw agErr
      setAgreements(ags)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleOnboardingComplete() {
    setShowOnboarding(false)
    load()
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <p className="text-white font-medium mb-2">Unable to load your portal</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    </div>
  )

  if (showOnboarding) return <RecipientOnboarding onComplete={handleOnboardingComplete} />

  const firstName   = recipient?.first_name ?? 'there'
  const activeCount = agreements.filter(a => a.status === 'active').length

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="32" height="20" viewBox="0 0 80 44" fill="none">
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
            <span className="text-white font-semibold text-sm">BonusBridge</span>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')}
            className="text-slate-400 hover:text-white text-xs font-medium transition">Sign Out</button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Hi, {firstName}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {activeCount > 0
              ? `You have ${activeCount} active bonus agreement${activeCount !== 1 ? 's' : ''}.`
              : 'No active agreements at this time.'}
          </p>
        </div>

        {agreements.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
            <p className="text-slate-400 text-sm">No agreements found. Contact your HR team if you believe this is an error.</p>
          </div>
        ) : (
          agreements.map(ag => <AgreementCard key={ag.id} agreement={ag} />)
        )}

        {recipient && <ContactEditor recipient={recipient} onSaved={load} />}

        <p className="text-slate-600 text-xs text-center pb-4">
          Questions about your agreement? Contact your HR or Finance team directly. BonusBridge is an administrative platform and does not have authority over the terms of your agreement.
        </p>
      </div>
    </div>
  )
}
