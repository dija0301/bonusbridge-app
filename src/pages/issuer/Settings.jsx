import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ── Constants ──────────────────────────────────────────────
const DAYS_OPTIONS = [
  { value: 7,  label: '7 days before' },
  { value: 14, label: '14 days before' },
  { value: 30, label: '30 days before' },
  { value: 60, label: '60 days before' },
]

const MONTH_OPTIONS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
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
]

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

// ── UI Components ──────────────────────────────────────────
function Toggle({ label, checked, onChange, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" className="sr-only" checked={!!checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-9 h-5 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-700'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
      <div>
        <p className="text-slate-200 text-sm font-medium">{label}</p>
        {hint && <p className="text-slate-500 text-xs mt-0.5">{hint}</p>}
      </div>
    </label>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', hint }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition" />
      {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, options, hint }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">{label}</label>
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition">
        <option value="">Select…</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, hint, rows = 3 }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">{label}</label>
      <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition resize-none" />
      {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
    </div>
  )
}

function SectionCard({ title, description, children, locked, lockReason }) {
  return (
    <div className={`bg-slate-900 border rounded-2xl overflow-hidden ${locked ? 'border-slate-800 opacity-75' : 'border-slate-800'}`}>
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">{title}</h3>
            {description && <p className="text-slate-400 text-sm mt-0.5">{description}</p>}
          </div>
          {locked && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-lg">
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>
              <span className="text-slate-400 text-xs font-medium">{lockReason ?? 'Coming Soon'}</span>
            </div>
          )}
        </div>
      </div>
      <div className={`px-6 py-5 flex flex-col gap-4 ${locked ? 'pointer-events-none select-none' : ''}`}>
        {children}
      </div>
    </div>
  )
}

function Divider() { return <div className="h-px bg-slate-800" /> }

function ComingSoonContent({ description, features }) {
  return (
    <div className="py-2">
      <p className="text-slate-500 text-sm mb-4">{description}</p>
      <div className="flex flex-col gap-2">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-slate-600 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 shrink-0" />
            {f}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Settings page ─────────────────────────────────────
export default function Settings() {
  const { profile, features } = useAuth()
  const issuerId    = profile?.issuer_id

  const [org, setOrg]               = useState(null)
  const [notif, setNotif]           = useState(null)
  const [customFields, setCustomFields] = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => { if (issuerId) load() }, [issuerId])

  async function load() {
    setLoading(true)
    const [orgRes, notifRes, cfRes] = await Promise.all([
      supabase.from('issuers').select('*').eq('id', issuerId).single(),
      supabase.from('notification_settings').select('*').eq('issuer_id', issuerId).single(),
      supabase.from('issuer_custom_fields').select('*').eq('issuer_id', issuerId).order('sort_order'),
    ])

    setOrg(orgRes.data)
    setCustomFields(cfRes.data ?? [])

    if (notifRes.error?.code === 'PGRST116') {
      const { data } = await supabase
        .from('notification_settings')
        .insert({ issuer_id: issuerId })
        .select().single()
      setNotif(data)
    } else {
      setNotif(notifRes.data)
    }
    setLoading(false)
  }

  function setO(k, v) { setOrg(o => ({ ...o, [k]: v })) }
  function setN(k, v) { setNotif(n => ({ ...n, [k]: v })) }

  function addCustomField() {
    if (customFields.length >= 10) return
    setCustomFields(f => [...f, { id: null, issuer_id: issuerId, field_key: '', field_label: '', field_type: 'text', sort_order: f.length, is_active: true, _new: true }])
  }

  function updateCustomField(i, k, v) {
    setCustomFields(f => f.map((field, idx) => idx === i ? { ...field, [k]: v } : field))
  }

  function removeCustomField(i) {
    setCustomFields(f => f.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    // Save custom fields
    for (const field of customFields) {
      if (!field.field_label) continue
      const key = field.field_key || field.field_label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      if (field.id) {
        await supabase.from('issuer_custom_fields').update({ field_label: field.field_label, field_key: key, field_type: field.field_type, sort_order: field.sort_order, is_active: field.is_active }).eq('id', field.id)
      } else {
        await supabase.from('issuer_custom_fields').insert({ issuer_id: issuerId, field_label: field.field_label, field_key: key, field_type: field.field_type, sort_order: field.sort_order, is_active: true })
      }
    }

    const [orgRes, notifRes] = await Promise.all([
      supabase.from('issuers').update({
        name:                  org.name,
        primary_contact_email: org.primary_contact_email,
        default_work_state:    org.default_work_state,
      }).eq('id', issuerId),

      supabase.from('notification_settings').upsert({
        ...notif,
        issuer_id:  issuerId,
        updated_at: new Date().toISOString(),
      }),
    ])

    setSaving(false)
    if (orgRes.error || notifRes.error) {
      setError(orgRes.error?.message ?? notifRes.error?.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-2xl font-semibold">Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Configure your organization's preferences</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-emerald-400 text-sm font-medium">Saved</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
      )}

      <div className="flex flex-col gap-5">

        {/* ── Organization Profile ── */}
        <SectionCard title="Organization Profile" description="How your organization appears to recipients">
          <Field label="Organization Name" value={org?.name}
            onChange={v => setO('name', v)}
            placeholder="Allina Health"
            hint="Appears in recipient emails and the portal header" />
          <Field label="Primary Contact Email" type="email" value={org?.primary_contact_email}
            onChange={v => setO('primary_contact_email', v)}
            placeholder="hr@yourorganization.com"
            hint="Used as reply-to on outgoing emails" />
          <SelectField label="Default Work State" value={org?.default_work_state}
            onChange={v => setO('default_work_state', v)}
            options={US_STATES}
            hint="Pre-fills the work state on new agreements — can be changed per agreement" />
        </SectionCard>

        {/* ── Agreement Defaults ── */}
        <SectionCard title="Agreement Defaults" description="Default values pre-filled when creating new agreements">
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Default Interest Rate Type" value={notif?.default_interest_rate_type}
              onChange={v => setN('default_interest_rate_type', v)}
              options={INTEREST_RATE_TYPES} />
            <SelectField label="Default Forgiveness Frequency" value={notif?.default_forgiveness_frequency}
              onChange={v => setN('default_forgiveness_frequency', v)}
              options={FORGIVENESS_FREQUENCIES} />
          </div>
          <Divider />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Default Eligibility Criteria</p>
          <p className="text-slate-500 text-xs -mt-2">These will be pre-checked on every new agreement</p>
          <Toggle label="Benefits Eligible Required" checked={notif?.default_elig_benefits_eligible}
            onChange={v => setN('default_elig_benefits_eligible', v)} />
          <Toggle label="Must Maintain Role" checked={notif?.default_elig_maintain_role}
            onChange={v => setN('default_elig_maintain_role', v)} />
          <Toggle label="Licensure Required" checked={notif?.default_elig_licensure_required}
            onChange={v => setN('default_elig_licensure_required', v)} />
          <Divider />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Agreement Number Prefix" value={notif?.agreement_number_prefix}
              onChange={v => setN('agreement_number_prefix', v)}
              placeholder="BB"
              hint="e.g. BB generates BB-2026-001" />
            <div className="flex flex-col justify-end">
              <Toggle label="Auto-generate agreement numbers"
                checked={notif?.agreement_number_auto}
                onChange={v => setN('agreement_number_auto', v)} />
            </div>
          </div>
        </SectionCard>

        {/* ── Portal Customization ── */}
        <SectionCard title="Recipient Portal Customization" description="Customize what recipients see in their portal">
          <TextArea label="Welcome Message" value={notif?.portal_welcome_message}
            onChange={v => setN('portal_welcome_message', v)}
            placeholder="Welcome to your BonusBridge portal. If you have questions about your agreement, please contact HR."
            hint="Displayed at the top of the recipient portal" />
          <Divider />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">HR Contact Information</p>
          <p className="text-slate-500 text-xs -mt-2">Shown to recipients in their portal and in notification emails</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="HR Contact Name" value={notif?.portal_hr_contact_name}
              onChange={v => setN('portal_hr_contact_name', v)}
              placeholder="Jane Smith, HR Director" />
            <Field label="HR Contact Email" type="email" value={notif?.portal_hr_contact_email}
              onChange={v => setN('portal_hr_contact_email', v)}
              placeholder="hr@yourorganization.com" />
          </div>
          <Divider />
          <Toggle label="Allow recipients to update their contact information"
            checked={notif?.allow_recipient_contact_update}
            onChange={v => setN('allow_recipient_contact_update', v)}
            hint="Allows recipients to edit their personal email, mobile phone, and mailing address from their portal" />
        </SectionCard>

        {/* ── Notification Preferences — gated by feature flag ── */}
        {features?.notifications && (
        <SectionCard title="Notification Preferences" description="Configure when and how recipients are notified">

          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Forgiveness Period Reminders</p>
          <Toggle label="Send forgiveness reminders" checked={notif?.forgiveness_reminders}
            onChange={v => setN('forgiveness_reminders', v)}
            hint="Notify recipients before upcoming forgiveness periods" />
          {notif?.forgiveness_reminders && (
            <SelectField label="Send reminder" value={notif?.forgiveness_days_before}
              onChange={v => setN('forgiveness_days_before', Number(v))}
              options={DAYS_OPTIONS} />
          )}

          <Divider />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Retention Payment Reminders</p>
          <Toggle label="Send retention payment reminders" checked={notif?.retention_reminders}
            onChange={v => setN('retention_reminders', v)}
            hint="Notify recipients before scheduled retention payments" />
          {notif?.retention_reminders && (
            <SelectField label="Send reminder" value={notif?.retention_days_before}
              onChange={v => setN('retention_days_before', Number(v))}
              options={DAYS_OPTIONS} />
          )}

          <Divider />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Performance Milestone Reminders</p>
          <Toggle label="Send milestone reminders" checked={notif?.milestone_reminders}
            onChange={v => setN('milestone_reminders', v)}
            hint="Notify recipients before performance milestone measurement dates" />
          {notif?.milestone_reminders && (
            <SelectField label="Send reminder" value={notif?.milestone_days_before}
              onChange={v => setN('milestone_days_before', Number(v))}
              options={DAYS_OPTIONS} />
          )}

          <Divider />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Annual Summary</p>
          <Toggle label="Send annual agreement summary" checked={notif?.annual_summary}
            onChange={v => setN('annual_summary', v)}
            hint="Recipients receive a full summary of their agreement status once per year" />
          {notif?.annual_summary && (
            <SelectField label="Send in" value={notif?.annual_summary_month}
              onChange={v => setN('annual_summary_month', Number(v))}
              options={MONTH_OPTIONS}
              hint="Month in which annual summaries are delivered" />
          )}

          <Divider />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Who Receives Notifications</p>
          <Toggle label="Notify agreement recipient" checked={notif?.notify_recipient}
            onChange={v => setN('notify_recipient', v)} />
          <Toggle label="Send copy to issuer" checked={notif?.notify_issuer}
            onChange={v => setN('notify_issuer', v)}
            hint="A copy of each notification is sent to an issuer email address" />
          {notif?.notify_issuer && (
            <Field label="Issuer notification email" type="email" value={notif?.issuer_notify_email}
              onChange={v => setN('issuer_notify_email', v)}
              placeholder="hr@yourorganization.com" />
          )}

          <Divider />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Recipient Opt-Out</p>
          <Toggle label="Allow recipients to opt out of reminder emails"
            checked={notif?.allow_recipient_optout}
            onChange={v => setN('allow_recipient_optout', v)}
            hint="Transactional emails (acknowledgment, status changes) cannot be opted out of" />
        </SectionCard>
        )}

        {/* ── Custom Org Fields ── */}
        <SectionCard title="Custom Organization Fields" description="Add up to 10 custom fields for recipients — cost center, location, clinic ID, or any internal identifier needed for payroll or reporting">
          <p className="text-slate-500 text-xs -mt-2">Custom fields appear on recipient records, are included in CSV exports, and can be used to filter reports.</p>

          <div className="flex flex-col gap-3">
            {customFields.map((field, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="text"
                  value={field.field_label}
                  onChange={e => updateCustomField(i, 'field_label', e.target.value)}
                  placeholder="Field label (e.g. Cost Center)"
                  className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition"
                />
                <select
                  value={field.field_type}
                  onChange={e => updateCustomField(i, 'field_type', e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition">
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                </select>
                <button onClick={() => removeCustomField(i)} className="text-slate-500 hover:text-red-400 transition text-sm">✕</button>
              </div>
            ))}
          </div>

          {customFields.length < 10 ? (
            <button onClick={addCustomField}
              className="flex items-center gap-2 text-brand-400 hover:text-brand-300 text-sm font-medium transition">
              + Add Field
              <span className="text-slate-600 text-xs font-normal">{10 - customFields.length} remaining</span>
            </button>
          ) : (
            <p className="text-slate-600 text-xs">Maximum of 10 custom fields reached.</p>
          )}
        </SectionCard>

        {/* ── User Management — Coming Soon ── */}
        <SectionCard
          title="User Management"
          description="Invite and manage additional users for your organization"
          locked
          lockReason="Coming Soon">
          <ComingSoonContent
            description="Give your team the right level of access to BonusBridge."
            features={[
              'Invite HR, Finance, and Legal team members',
              'Role-based access — Admin vs Read-Only',
              'Deactivate users when they leave the organization',
              'Activity log showing who made changes',
            ]} />
        </SectionCard>

        {/* ── Security & Compliance — Coming Soon ── */}
        <SectionCard
          title="Security & Compliance"
          description="Advanced security settings for enterprise compliance"
          locked
          lockReason="Coming Soon">
          <ComingSoonContent
            description="Enterprise-grade security controls for compliance-sensitive environments."
            features={[
              'Multi-factor authentication (MFA) requirement',
              'Session timeout configuration',
              'Full audit log download for compliance review',
              'IP allowlist for issuer access',
            ]} />
        </SectionCard>

        {/* ── DocuSign Integration — gated by feature flag ── */}
        {features?.docusign && (
        <SectionCard
          title="DocuSign Integration"
          description="Execute promissory notes digitally — pre-filled from agreement data and sent for signature">

          {notif?.docusign_account_id && notif?.docusign_template_id ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-2">
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="2 8 6 12 14 4"/></svg>
              <p className="text-emerald-400 text-sm font-medium">DocuSign connected</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg mb-2">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>
              <p className="text-slate-400 text-sm">Not connected — add your DocuSign credentials below to enable</p>
            </div>
          )}

          <Field
            label="DocuSign Account ID"
            value={notif?.docusign_account_id}
            onChange={v => setN('docusign_account_id', v)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            hint="Found in DocuSign Admin → Apps and Keys" />

          <Field
            label="Default Template ID"
            value={notif?.docusign_template_id}
            onChange={v => setN('docusign_template_id', v)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            hint="The DocuSign template ID for your promissory note. Each bonus type can have its own template — contact BonusBridge to configure custom templates." />

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-300 text-sm font-medium mb-2">How document integration works</p>
            <div className="flex flex-col gap-1.5">
              {[
                'BonusBridge pre-fills your promissory note template with agreement data',
                'DocuSign sends the document to the recipient for electronic signature',
                'Signed document is stored securely and linked to the agreement record',
                'BonusBridge invite is sent after signing — recipient completes onboarding',
                'Full audit trail: signed document + acknowledgment timestamp + review period',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-400 text-xs">
                  <span className="text-brand-400 mt-0.5 shrink-0">{i + 1}.</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="text-slate-500 text-xs">
            Need help setting up your document templates? Document integration and template mapping is included in the Portfolio Kickstart service. <a href="mailto:info@thebonusbridge.com" className="text-brand-400 hover:text-brand-300">Contact us →</a>
          </p>
        </SectionCard>
        )}

        {/* ── Integrations — Coming Soon ── */}
        <SectionCard
          title="Additional Integrations"
          description="Connect BonusBridge with your existing HR and payroll systems"
          locked
          lockReason="Coming Soon">
          <ComingSoonContent
            description="Seamlessly connect with the tools your organization already uses."
            features={[
              'Payroll export — formatted for ADP, Paychex, Workday',
              'HRIS sync — auto-import recipient data from your HR system',
              'SSO — single sign-on via your identity provider',
              'Slack notifications — alert HR team on key agreement events',
            ]} />
        </SectionCard>

        {/* Save button */}
        <div className="flex justify-end pt-2 pb-8">
          <button onClick={handleSave} disabled={saving}
            className="bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  )
}
