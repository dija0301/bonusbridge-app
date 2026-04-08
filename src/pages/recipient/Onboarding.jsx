import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'

const BONUS_TYPE_LABELS = {
  signing_bonus:     'Signing Bonus — Forgivable Promissory Note',
  starting_bonus:    'Starting Bonus',
  retention_bonus:   'Retention Bonus',
  performance_bonus: 'Performance Bonus',
  custom:            'Custom Agreement',
}

const FREQ_LABELS = {
  biweekly: 'Biweekly', semi_monthly: 'Semi-Monthly', monthly: 'Monthly',
  quarterly: 'Quarterly', annual: 'Annual', custom: 'Custom',
}

function CheckIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="2 8 6 12 14 4"/></svg>
}

function Step({ number, label, active, complete }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition ${
        complete ? 'bg-emerald-500 border-emerald-500 text-white' :
        active   ? 'bg-brand-600 border-brand-600 text-white' :
                   'bg-slate-800 border-slate-700 text-slate-500'
      }`}>
        {complete ? <CheckIcon className="w-3.5 h-3.5" /> : number}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-white' : complete ? 'text-emerald-400' : 'text-slate-500'}`}>{label}</span>
    </div>
  )
}

export default function RecipientOnboarding({ onComplete }) {
  const { session } = useAuth()
  const [step, setStep]             = useState(1) // 1=review, 2=contact, 3=acknowledge, 4=password
  const [recipient, setRecipient]   = useState(null)
  const [agreements, setAgreements] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [saving, setSaving]         = useState(false)

  // Contact form
  const [contact, setContact] = useState({
    personal_email: '', mobile_phone: '', address_line1: '',
    address_line2: '', city: '', state: '', zip: '',
  })

  // Acknowledgment
  const [acknowledged, setAcknowledged] = useState(false)

  // Password
  const [password, setPassword]     = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [pwError, setPwError]       = useState(null)

  useEffect(() => { if (session?.user?.id) load() }, [session])

  async function load() {
    setLoading(true)
    try {
      const { data: rec, error: recErr } = await supabase
        .from('recipients').select('*').eq('user_id', session.user.id).single()
      if (recErr) throw new Error('Could not find your recipient profile. Contact your HR team.')

      setRecipient(rec)
      setContact({
        personal_email: rec.personal_email ?? '',
        mobile_phone:   rec.mobile_phone ?? '',
        address_line1:  rec.address_line1 ?? '',
        address_line2:  rec.address_line2 ?? '',
        city:           rec.city ?? '',
        state:          rec.state ?? '',
        zip:            rec.zip ?? '',
      })

      const { data: ags, error: agErr } = await supabase
        .from('agreements').select('*')
        .eq('recipient_id', rec.id)
        .in('status', ['onboarding', 'active', 'draft'])
        .order('created_at', { ascending: false })
      if (agErr) throw agErr
      setAgreements(ags)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function saveContact() {
    setSaving(true)
    const changed = Object.entries(contact).filter(([k, v]) => v !== (recipient[k] ?? ''))
    const { error: updateErr } = await supabase.from('recipients').update(contact).eq('id', recipient.id)
    if (updateErr) { setSaving(false); setError(updateErr.message); return }
    for (const [field, newVal] of changed) {
      await supabase.from('recipient_events').insert({
        recipient_id: recipient.id, issuer_id: recipient.issuer_id,
        event_type: 'contact_update', field_changed: field,
        old_value: recipient[field] ?? null, new_value: newVal,
      })
    }
    setSaving(false)
    setStep(3)
  }

  async function handleAcknowledge() {
    if (!acknowledged) return
    setSaving(true)
    const now = new Date().toISOString()

    // Update each agreement — set acknowledged_at and update status to active
    for (const ag of agreements) {
      await supabase.from('agreements').update({
        acknowledged_at: now,
        acknowledged_by: session.user.id,
        status: ag.status === 'onboarding' ? 'active' : ag.status,
      }).eq('id', ag.id)

      await supabase.from('recipient_events').insert({
        recipient_id: recipient.id,
        issuer_id:    recipient.issuer_id,
        event_type:   'agreement_acknowledged',
        new_value:    ag.id,
      })
    }

    // Mark recipient onboarding complete and update login timestamps
    const loginUpdates = {
      onboarding_complete: true,
      last_login_at: now,
    }
    if (!recipient.first_login_at) loginUpdates.first_login_at = now
    await supabase.from('recipients').update(loginUpdates).eq('id', recipient.id)

    setSaving(false)
    setStep(4) // Go to password setup
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    setPwError(null)
    if (password.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (password !== confirmPw) { setPwError('Passwords do not match.'); return }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (error) { setPwError(error.message); return }
    onComplete()
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <p className="text-white font-medium mb-2">Unable to load your onboarding</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    </div>
  )

  const issuerName = 'Your organization' // pulled from agreement context

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
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">

        {/* Welcome */}
        <div>
          <h1 className="text-white text-2xl font-semibold mb-1">
            Welcome, {recipient?.first_name}
          </h1>
          <p className="text-slate-400 text-sm">
            Your employer has set up a bonus agreement for you. Please review the terms, confirm your contact information, and acknowledge the agreement below.
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-4 flex-wrap">
          <Step number={1} label="Review Agreement" active={step === 1} complete={step > 1} />
          <div className="flex-1 h-px bg-slate-800 hidden sm:block" />
          <Step number={2} label="Confirm Contact"  active={step === 2} complete={step > 2} />
          <div className="flex-1 h-px bg-slate-800 hidden sm:block" />
          <Step number={3} label="Acknowledge"      active={step === 3} complete={step > 3} />
          <div className="flex-1 h-px bg-slate-800 hidden sm:block" />
          <Step number={4} label="Set Password"     active={step === 4} complete={false} />
        </div>

        {/* Step 1 — Review agreements */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            {agreements.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-slate-400 text-sm">No agreements found. Contact your HR team.</p>
              </div>
            ) : (
              agreements.map(ag => (
                <AgreementReviewCard key={ag.id} agreement={ag} />
              ))
            )}
            <button onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition">
              I have reviewed my agreement — Continue
            </button>
          </div>
        )}

        {/* Step 2 — Contact info */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Confirm Your Contact Information</h3>
              <p className="text-slate-400 text-sm mb-5">
                Please provide your personal contact details. These are used to reach you if your employment status changes — keep them current and accurate.
              </p>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ContactField label="Personal Email" type="email" value={contact.personal_email}
                    onChange={v => setContact(c => ({ ...c, personal_email: v }))} placeholder="your@personal.com" />
                  <ContactField label="Mobile Phone" type="tel" value={contact.mobile_phone}
                    onChange={v => setContact(c => ({ ...c, mobile_phone: v }))} placeholder="(612) 555-0101" />
                </div>
                <ContactField label="Mailing Address" value={contact.address_line1}
                  onChange={v => setContact(c => ({ ...c, address_line1: v }))} placeholder="123 Main St" />
                <ContactField label="Address Line 2 (optional)" value={contact.address_line2}
                  onChange={v => setContact(c => ({ ...c, address_line2: v }))} placeholder="Apt, Suite…" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <ContactField label="City" value={contact.city}
                      onChange={v => setContact(c => ({ ...c, city: v }))} placeholder="Minneapolis" />
                  </div>
                  <ContactField label="State" value={contact.state}
                    onChange={v => setContact(c => ({ ...c, state: v }))} placeholder="MN" />
                  <ContactField label="ZIP" value={contact.zip}
                    onChange={v => setContact(c => ({ ...c, zip: v }))} placeholder="55401" />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
                Back
              </button>
              <button onClick={saveContact} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold text-sm transition">
                {saving ? 'Saving…' : 'Confirm Contact Information'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Acknowledge */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Acknowledge Your Agreement</h3>
              <p className="text-slate-400 text-sm mb-6">
                By checking the box below, you confirm that you have reviewed the terms of your bonus agreement, that your contact information is accurate, and that you understand your obligations under this agreement.
              </p>

              <label className="flex items-start gap-4 cursor-pointer p-4 rounded-xl border border-slate-700 hover:border-brand-500 transition bg-slate-800/40">
                <div className="relative mt-0.5 shrink-0">
                  <input type="checkbox" className="sr-only" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${acknowledged ? 'bg-brand-600 border-brand-600' : 'border-slate-600 bg-slate-800'}`}>
                    {acknowledged && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  I have read and reviewed the terms of my bonus agreement. I understand my eligibility requirements, the forgiveness schedule, and my obligations if my employment ends before the agreement is fully forgiven. I confirm my contact information is accurate and current.
                </p>
              </label>

              <p className="text-slate-500 text-xs mt-3">
                Your acknowledgment will be timestamped and recorded. This does not constitute a legally binding signature — consult your employer or legal counsel if you have questions about the agreement terms.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
                Back
              </button>
              <button onClick={handleAcknowledge} disabled={!acknowledged || saving}
                className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-semibold text-sm transition">
                {saving ? 'Recording…' : 'Acknowledge and Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Set password */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Set Your Password</h3>
              <p className="text-slate-400 text-sm mb-6">
                Create a password so you can log in to your portal directly in the future. You can always use the magic link from an invite email as an alternative.
              </p>

              <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
                <ContactField label="Password" type="password" value={password}
                  onChange={v => setPassword(v)} placeholder="At least 8 characters" />
                <ContactField label="Confirm Password" type="password" value={confirmPw}
                  onChange={v => setConfirmPw(v)} placeholder="Repeat your password" />

                {pwError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">{pwError}</div>
                )}

                <button type="submit" disabled={saving}
                  className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold text-sm transition">
                  {saving ? 'Setting password…' : 'Set Password and Enter Portal'}
                </button>

                <button type="button" onClick={onComplete}
                  className="text-slate-500 hover:text-slate-300 text-sm text-center transition">
                  Skip for now — I'll set a password later
                </button>
              </form>
            </div>
          </div>
        )}

        <p className="text-slate-600 text-xs text-center pb-4">
          Questions about your agreement? Contact your HR or Finance team directly. The BonusBridge LLC is an administrative platform and does not have authority over the terms of your agreement.
        </p>
      </div>
    </div>
  )
}

// ── Agreement review card ──────────────────────────────────
function AgreementReviewCard({ agreement: ag }) {
  const elig = ag.eligibility_criteria ?? {}
  const isPN = ag.bonus_type === 'signing_bonus'
  const isStarting = ag.bonus_type === 'starting_bonus'
  const isRetention = ag.bonus_type === 'retention_bonus'
  const isPerf = ag.bonus_type === 'performance_bonus'

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
          {BONUS_TYPE_LABELS[ag.bonus_type] ?? ag.bonus_type}
        </p>
        {ag.agreement_number && <p className="text-slate-500 text-xs">Agreement No. {ag.agreement_number}</p>}
      </div>

      {/* Financial summary */}
      {(isPN || isStarting) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/60 rounded-xl p-3">
            <p className="text-slate-400 text-xs mb-0.5">Principal Amount</p>
            <p className="text-white font-mono font-bold text-lg">{fmt(ag.principal_amount)}</p>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3">
            <p className="text-slate-400 text-xs mb-0.5">Forgiveness Schedule</p>
            <p className="text-white text-sm font-medium">
              {ag.forgiveness_periods} {FREQ_LABELS[ag.forgiveness_frequency]} periods
            </p>
            {ag.forgiveness_amount_per_period && (
              <p className="text-slate-400 text-xs">{fmt(ag.forgiveness_amount_per_period)} per period</p>
            )}
          </div>
        </div>
      )}

      {/* Retention payments */}
      {isRetention && ag.custom_terms?.installments?.length > 0 && (
        <div>
          <p className="text-slate-400 text-xs mb-2">Payment Schedule</p>
          <div className="flex flex-col gap-1.5">
            {ag.custom_terms.installments.map((inst, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-800/60 rounded-lg">
                <span className="text-slate-300 text-sm">{inst.date ? fmtDate(inst.date) : '—'}</span>
                <span className="text-white font-mono text-sm font-semibold">{fmt(inst.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance milestones */}
      {isPerf && ag.custom_terms?.milestones?.length > 0 && (
        <div>
          <p className="text-slate-400 text-xs mb-2">Milestones</p>
          <div className="flex flex-col gap-1.5">
            {ag.custom_terms.milestones.map((m, i) => (
              <div key={i} className="bg-slate-800/60 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">{m.description || `Milestone ${i + 1}`}</span>
                  <span className="text-white font-mono text-sm font-semibold">{fmt(m.amount)}</span>
                </div>
                {m.target_value && <p className="text-slate-500 text-xs mt-0.5">Target: {m.target_value}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key dates */}
      <div className="grid grid-cols-2 gap-3">
        {ag.effective_date && (
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Effective Date</p>
            <p className="text-slate-200 text-sm">{fmtDate(ag.effective_date)}</p>
          </div>
        )}
        {ag.forgiveness_start_date && (
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Forgiveness Start</p>
            <p className="text-slate-200 text-sm">{fmtDate(ag.forgiveness_start_date)}</p>
          </div>
        )}
        {ag.projected_end_date && (
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Projected End</p>
            <p className="text-slate-200 text-sm">{fmtDate(ag.projected_end_date)}</p>
          </div>
        )}
        {ag.execution_date && (
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Execution Date</p>
            <p className="text-slate-200 text-sm">{fmtDate(ag.execution_date)}</p>
          </div>
        )}
      </div>

      {/* Eligibility requirements */}
      {(elig.benefits_eligible || elig.maintain_role || elig.licensure_required || elig.min_fte || elig.notes) && (
        <div>
          <p className="text-slate-400 text-xs mb-2 font-semibold uppercase tracking-wide">Eligibility Requirements</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {elig.benefits_eligible  && <EligPill label="Benefits Eligible" />}
            {elig.maintain_role      && <EligPill label="Maintain Role" />}
            {elig.licensure_required && <EligPill label="Active Licensure" />}
            {elig.min_fte            && <EligPill label={`Min ${Math.round(elig.min_fte * 100)}% FTE`} />}
          </div>
          {elig.notes && <p className="text-slate-400 text-sm leading-relaxed">{elig.notes}</p>}
        </div>
      )}

      {/* Interest rate for promissory notes */}
      {isPN && ag.interest_rate && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
          <p className="text-yellow-400 text-xs font-semibold mb-0.5">Interest Rate Notice</p>
          <p className="text-slate-300 text-sm">
            This agreement carries a {ag.interest_rate}% annual interest rate. The forgiven interest is reported to payroll as additional taxable income each period.
          </p>
        </div>
      )}
    </div>
  )
}

function EligPill({ label }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs font-medium">
      <CheckIcon className="w-3 h-3" />
      {label}
    </div>
  )
}

function ContactField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition" />
    </div>
  )
}
