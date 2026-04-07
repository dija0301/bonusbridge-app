import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ── Icons ──────────────────────────────────────────────────
function PlusIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>
}
function MailIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M1 5l7 5 7-5"/></svg>
}
function UserIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="5" r="2.5"/><path d="M2 13c0-2.8 2.7-5 6-5s6 2.2 6 5"/></svg>
}
function XIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
}
function DownloadIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M2 12v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1"/></svg>
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const days = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
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

// ── Status config ──────────────────────────────────────────
const INVITE_STATUS = {
  active:  { label: 'Active',         cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pending: { label: 'Invite Pending', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'   },
  none:    { label: 'Not Invited',    cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20'       },
}

const RECIPIENT_STATUSES = [
  { value: 'active',     label: 'Active'     },
  { value: 'inactive',   label: 'Inactive'   },
  { value: 'terminated', label: 'Terminated' },
  { value: 'on_leave',   label: 'On Leave'   },
]

function inviteStatus(r) {
  if (r.user_id) return 'active'
  if (r.invite_sent_at) return 'pending'
  return 'none'
}

// ── Form field components ──────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', required = false, hint, half }) {
  return (
    <div className={half ? '' : ''}>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">
        {label}{required && <span className="text-brand-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
      />
      {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, options, required }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">
        {label}{required && <span className="text-brand-400 ml-0.5">*</span>}
      </label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
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

// ── Empty state ────────────────────────────────────────────
function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-4">
        <UserIcon className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-slate-200 font-medium mb-1">No recipients yet</p>
      <p className="text-slate-500 text-sm mb-6 max-w-xs">Add your first recipient to start creating agreements and tracking bonuses.</p>
      <button onClick={onAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
        <PlusIcon className="w-4 h-4" /> Add Recipient
      </button>
    </div>
  )
}

// ── Deactivate confirmation ────────────────────────────────
function ConfirmDialog({ name, isActive, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-white font-semibold mb-2">
          {isActive ? 'Deactivate' : 'Reactivate'} {name}?
        </h3>
        <p className="text-slate-400 text-sm mb-6">
          {isActive
            ? 'This recipient will be marked inactive. Their agreements and history are preserved.'
            : 'This will restore the recipient to active status.'}
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition ${isActive ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-600 hover:bg-brand-500'}`}
          >
            {isActive ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Drawer ─────────────────────────────────────────────────
const EMPTY_FORM = {
  first_name: '', last_name: '', employee_id: '', title: '', department: '',
  recipient_status: 'active', start_date: '', termination_date: '',
  email: '', work_phone: '',
  personal_email: '', mobile_phone: '', preferred_contact: '',
  address_line1: '', address_line2: '', city: '', state: '', zip: '',
  notes: '',
}

const PREFERRED_OPTIONS = [
  { value: '',               label: 'Not specified'  },
  { value: 'work_email',     label: 'Work Email'     },
  { value: 'personal_email', label: 'Personal Email' },
  { value: 'work_phone',     label: 'Work Phone'     },
  { value: 'mobile_phone',   label: 'Mobile Phone'   },
]

function RecipientDrawer({ issuerId, recipient, onClose, onSaved }) {
  const [form, setForm]     = useState(recipient ? { ...EMPTY_FORM, ...recipient } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const isEdit              = !!recipient

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.email) {
      setError('First name, last name, and work email are required.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      first_name:        form.first_name.trim(),
      last_name:         form.last_name.trim(),
      employee_id:       form.employee_id?.trim() || null,
      title:             form.title?.trim() || null,
      department:        form.department?.trim() || null,
      email:             form.email.trim().toLowerCase(),
      work_phone:        form.work_phone?.trim() || null,
      personal_email:    form.personal_email?.trim().toLowerCase() || null,
      mobile_phone:      form.mobile_phone?.trim() || null,
      preferred_contact: form.preferred_contact || null,
      address_line1:     form.address_line1?.trim() || null,
      address_line2:     form.address_line2?.trim() || null,
      city:              form.city?.trim() || null,
      state:             form.state?.trim().toUpperCase() || null,
      zip:               form.zip?.trim() || null,
      notes:             form.notes?.trim() || null,
      is_active:         form.recipient_status === 'active' || form.recipient_status === 'on_leave',
      issuer_id:         issuerId,
    }

    let err
    if (isEdit) {
      ;({ error: err } = await supabase.from('recipients').update(payload).eq('id', recipient.id))
    } else {
      ;({ error: err } = await supabase.from('recipients').insert(payload))
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-white font-semibold">{isEdit ? 'Edit Recipient' : 'Add Recipient'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">

            <SectionLabel>Identity</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" required value={form.first_name} onChange={v => set('first_name', v)} placeholder="Jane" />
              <Field label="Last Name"  required value={form.last_name}  onChange={v => set('last_name', v)}  placeholder="Smith" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title"      value={form.title}      onChange={v => set('title', v)}      placeholder="Physician…" />
              <Field label="Department" value={form.department} onChange={v => set('department', v)} placeholder="HR, Finance…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Employee ID" value={form.employee_id} onChange={v => set('employee_id', v)} placeholder="Optional" />
              <SelectField
                label="Status"
                value={form.recipient_status}
                onChange={v => set('recipient_status', v)}
                options={RECIPIENT_STATUSES}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date"       type="date" value={form.start_date}       onChange={v => set('start_date', v)} />
              <Field label="Termination Date" type="date" value={form.termination_date} onChange={v => set('termination_date', v)} />
            </div>

            <SectionLabel>Work Contact</SectionLabel>
            <Field
              label="Work Email" required type="email"
              value={form.email} onChange={v => set('email', v)}
              placeholder="jane@organization.com"
              hint="Used for platform login and issuer communications"
            />
            <Field label="Work Phone" type="tel" value={form.work_phone} onChange={v => set('work_phone', v)} placeholder="(612) 555-0100" />

            <SectionLabel>Personal Contact</SectionLabel>
            <p className="text-slate-500 text-xs -mt-2">Critical if work contact becomes unreachable after departure. Recipient can update this in their portal.</p>
            <Field label="Personal Email" type="email" value={form.personal_email} onChange={v => set('personal_email', v)} placeholder="jane.smith@gmail.com" />
            <Field label="Mobile Phone"   type="tel"   value={form.mobile_phone}   onChange={v => set('mobile_phone', v)}   placeholder="(612) 555-0101" />
            <SelectField
              label="Preferred Contact Method"
              value={form.preferred_contact}
              onChange={v => set('preferred_contact', v)}
              options={PREFERRED_OPTIONS}
            />

            <SectionLabel>Mailing Address</SectionLabel>
            <Field label="Address Line 1" value={form.address_line1} onChange={v => set('address_line1', v)} placeholder="123 Main St" />
            <Field label="Address Line 2" value={form.address_line2} onChange={v => set('address_line2', v)} placeholder="Apt, Suite…" />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Field label="City"  value={form.city}  onChange={v => set('city', v)}  placeholder="Minneapolis" />
              </div>
              <Field label="State" value={form.state} onChange={v => set('state', v)} placeholder="MN" />
              <Field label="ZIP"   value={form.zip}   onChange={v => set('zip', v)}   placeholder="55401" />
            </div>

            <SectionLabel>Notes</SectionLabel>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5">Internal Notes</label>
              <textarea
                value={form.notes || ''}
                onChange={e => set('notes', e.target.value)}
                placeholder="Internal context about this recipient…"
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

          {/* Sticky footer */}
          <div className="shrink-0 px-5 py-4 border-t border-slate-800 flex gap-3 bg-slate-900">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium transition">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Recipient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detail panel (read-only) ───────────────────────────────
function RecipientDetailPanel({ recipient: r, onClose, onEdit, onInvite }) {
  const iStatus = inviteStatus(r)
  const { label, cls } = INVITE_STATUS[iStatus]
  const fmtDt = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const fmtTm = d => d ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

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
        <div className="grid grid-cols-2 gap-3">{children}</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col h-full">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-white font-semibold">{r.first_name} {r.last_name}</h2>
            <p className="text-slate-400 text-sm mt-0.5">{r.title || ''}{r.title && r.department ? ' · ' : ''}{r.department || ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1 mt-0.5">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>{label}</span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${r.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              {r.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <Section title="Identity">
            <Row label="Employee ID"  value={r.employee_id} />
            <Row label="Start Date"   value={fmtDt(r.start_date)} />
            <Row label="Termination"  value={fmtDt(r.termination_date)} />
            <div />
          </Section>

          <Section title="Work Contact">
            <Row label="Work Email"  value={r.email} />
            <Row label="Work Phone"  value={r.work_phone} />
          </Section>

          <Section title="Personal Contact">
            <Row label="Personal Email" value={r.personal_email} />
            <Row label="Mobile Phone"   value={r.mobile_phone} />
            <div className="col-span-2">
              <Row label="Preferred Contact" value={r.preferred_contact?.replace(/_/g, ' ')} />
            </div>
          </Section>

          {(r.address_line1 || r.city) && (
            <Section title="Mailing Address">
              <div className="col-span-2 flex flex-col gap-0.5">
                {r.address_line1 && <p className="text-slate-200 text-sm">{r.address_line1}</p>}
                {r.address_line2 && <p className="text-slate-200 text-sm">{r.address_line2}</p>}
                {(r.city || r.state || r.zip) && (
                  <p className="text-slate-200 text-sm">{[r.city, r.state, r.zip].filter(Boolean).join(', ')}</p>
                )}
              </div>
            </Section>
          )}

          <Section title="Portal Activity">
            <div>
              <p className="text-slate-500 text-xs mb-0.5">First Login</p>
              {r.first_login_at
                ? <div>
                    <p className="text-slate-200 text-sm">{fmtDt(r.first_login_at)}</p>
                    <p className="text-slate-500 text-xs">{daysSince(r.first_login_at)}</p>
                  </div>
                : <p className="text-slate-600 text-sm italic">Never logged in</p>
              }
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Last Login</p>
              {r.last_login_at
                ? <div>
                    <p className="text-slate-200 text-sm">{fmtDt(r.last_login_at)}</p>
                    <p className="text-slate-500 text-xs">{daysSince(r.last_login_at)}</p>
                  </div>
                : <p className="text-slate-600 text-sm italic">Never logged in</p>
              }
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Agreements</p>
              <p className="text-slate-200 text-sm font-mono">{r.agreements?.length ?? 0}</p>
            </div>
          </Section>

          {r.notes && (
            <div>
              <p className="text-slate-500 text-xs mb-1">Internal Notes</p>
              <p className="text-slate-300 text-sm leading-relaxed">{r.notes}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 px-5 py-4 border-t border-slate-800 flex gap-3">
          {r.is_active && (
            <button onClick={() => onInvite(r)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-brand-600 text-brand-400 hover:bg-brand-600/10 text-sm font-medium transition">
              <MailIcon className="w-4 h-4" />
              {iStatus === 'none' ? 'Send Invite' : 'Resend Invite'}
            </button>
          )}
          <button onClick={() => onEdit(r)}
            className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition">
            Edit Recipient
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
const FILTER_OPTIONS = [
  { value: 'all',        label: 'All'        },
  { value: 'active',     label: 'Active'     },
  { value: 'inactive',   label: 'Inactive'   },
  { value: 'terminated', label: 'Terminated' },
]

export default function Recipients() {
  const { profile } = useAuth()
  const issuerId    = profile?.issuer_id

  const [recipients, setRecipients] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing]       = useState(null)
  const [viewing, setViewing]       = useState(null)
  const [inviting, setInviting]     = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')

  useEffect(() => { if (issuerId) load() }, [issuerId])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('recipients')
      .select('*, agreements(id)')
      .eq('issuer_id', issuerId)
      .order('last_name', { ascending: true })
    setLoading(false)
    if (error) { setError(error.message); return }
    setRecipients(data)
  }

  function openAdd()     { setEditing(null); setDrawerOpen(true) }
  function openEdit(r)   { setEditing(r);    setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }
  function onSaved()     { closeDrawer(); load() }

  function exportRecipients() {
    const rows = filtered.map(r => ({
      'First Name':       r.first_name,
      'Last Name':        r.last_name,
      'Employee ID':      r.employee_id ?? '',
      'Title':            r.title ?? '',
      'Department':       r.department ?? '',
      'Work Email':       r.email,
      'Personal Email':   r.personal_email ?? '',
      'Mobile Phone':     r.mobile_phone ?? '',
      'Work Phone':       r.work_phone ?? '',
      'Address':          [r.address_line1, r.city, r.state, r.zip].filter(Boolean).join(', '),
      'Status':           r.is_active ? 'Active' : 'Inactive',
      'Portal Status':    inviteStatus(r),
      'Agreements':       r.agreements?.length ?? 0,
      'First Login':      r.first_login_at ? new Date(r.first_login_at).toLocaleDateString() : '',
      'Last Login':       r.last_login_at  ? new Date(r.last_login_at).toLocaleDateString()  : '',
      'Days Since Login': r.last_login_at  ? Math.floor((new Date() - new Date(r.last_login_at)) / (1000 * 60 * 60 * 24)) : '',
    }))
    exportCSV(rows, `recipients-${filter}-${new Date().toISOString().split('T')[0]}.csv`)
  }

  async function sendInvite(r) {
    setInviting(r.id)
    const { data: { session } } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('invite-recipient', {
      body: { recipient_id: r.id },
      headers: { Authorization: `Bearer ${session?.access_token}` }
    })
    console.log('Invite result:', { data, error })
    if (error) {
      alert(`Failed to send invite: ${error.message}\n\nDetails: ${JSON.stringify(error)}`)
    } else {
      alert(`Invite sent to ${r.email}`)
    }
    setInviting(null)
    load()
  }

  async function toggleActive(r) {
    await supabase.from('recipients').update({ is_active: !r.is_active }).eq('id', r.id)
    setConfirming(null)
    load()
  }

  // Filter + search
  const filtered = recipients.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = [r.first_name, r.last_name, r.email, r.personal_email, r.title, r.department]
      .some(f => f?.toLowerCase().includes(q))
    const matchFilter =
      filter === 'all'        ? true :
      filter === 'active'     ? r.is_active :
      filter === 'inactive'   ? !r.is_active :
      filter === 'terminated' ? false : true
    return matchSearch && matchFilter
  })

  const activeCount     = recipients.filter(r => r.is_active).length
  const inactiveCount   = recipients.filter(r => !r.is_active).length

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Recipients</h1>
          <p className="text-slate-400 text-sm mt-1">
            {activeCount} active · {inactiveCount} inactive
          </p>
        </div>
        <div className="flex items-center gap-3">
          {filtered.length > 0 && (
            <button onClick={exportRecipients}
              className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
              <DownloadIcon className="w-4 h-4" /> Export
            </button>
          )}
          <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition w-full sm:w-auto justify-center">
            <PlusIcon className="w-4 h-4" /> Add Recipient
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
      )}

      {/* Filters + search */}
      {recipients.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, title…"
            className="flex-1 bg-slate-900 border border-slate-800 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
          />
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            {FILTER_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setFilter(o.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${filter === o.value ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table — scrolls horizontally on small screens */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 && recipients.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">No recipients match your filter</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                  <th className="text-left px-5 py-3 font-medium">Recipient</th>
                  <th className="text-left px-5 py-3 font-medium">Contact</th>
                  <th className="text-left px-5 py-3 font-medium">Role</th>
                  <th className="text-left px-5 py-3 font-medium">Agreements</th>
                  <th className="text-left px-5 py-3 font-medium">Last Login</th>
                  <th className="text-left px-5 py-3 font-medium">Portal</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(r => {
                  const iStatus = inviteStatus(r)
                  const { label, cls } = INVITE_STATUS[iStatus]
                  return (
                    <tr key={r.id} className={`hover:bg-slate-800/30 transition cursor-pointer ${!r.is_active ? 'opacity-50' : ''}`}
                        onClick={() => setViewing(r)}>
                      <td className="px-5 py-3.5">
                        <p className="text-brand-400 hover:text-brand-300 font-medium transition">{r.first_name} {r.last_name}</p>
                        {r.employee_id && <p className="text-slate-500 text-xs mt-0.5">ID: {r.employee_id}</p>}
                        {!r.is_active && <span className="text-xs text-red-400">Inactive</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-slate-300 text-xs">{r.email}</p>
                        {r.personal_email && <p className="text-slate-500 text-xs mt-0.5">{r.personal_email}</p>}
                        {r.mobile_phone   && <p className="text-slate-500 text-xs mt-0.5">{r.mobile_phone}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-slate-300">{r.title || '—'}</p>
                        <p className="text-slate-500 text-xs">{r.department || ''}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-slate-300 font-mono">{r.agreements?.length ?? 0}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {r.last_login_at
                          ? <div>
                              <p className="text-slate-300 text-xs">{new Date(r.last_login_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                              <p className="text-slate-500 text-xs">{daysSince(r.last_login_at)}</p>
                            </div>
                          : <span className="text-slate-600 text-xs italic">Never</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>
                      </td>
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {r.is_active && (
                            <button
                              onClick={() => sendInvite(r)}
                              disabled={inviting === r.id}
                              className="flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300 disabled:opacity-50 transition"
                            >
                              <MailIcon className="w-3.5 h-3.5" />
                              {inviting === r.id ? 'Sending…' : iStatus === 'none' ? 'Invite' : 'Resend Invite'}
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(r)}
                            className="text-xs font-medium text-slate-400 hover:text-white transition px-2 py-1 rounded hover:bg-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirming(r)}
                            className={`text-xs font-medium transition px-2 py-1 rounded ${r.is_active ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'}`}
                          >
                            {r.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawers + dialogs */}
      {drawerOpen && (
        <RecipientDrawer
          issuerId={issuerId}
          recipient={editing}
          onClose={closeDrawer}
          onSaved={onSaved}
        />
      )}

      {viewing && (
        <RecipientDetailPanel
          recipient={viewing}
          onClose={() => setViewing(null)}
          onEdit={r => { setViewing(null); openEdit(r) }}
          onInvite={r => { setViewing(null); sendInvite(r) }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          name={`${confirming.first_name} ${confirming.last_name}`}
          isActive={confirming.is_active}
          onConfirm={() => toggleActive(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
