import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ── Icons ─────────────────────────────────────────────────
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

// ── Invite status badge ────────────────────────────────────
const STATUS = {
  active:  { label: 'Active',         cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pending: { label: 'Invite Pending', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'   },
  none:    { label: 'Not Invited',    cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20'       },
}

function inviteStatus(r) {
  if (r.user_id) return 'active'
  if (r.invite_sent_at) return 'pending'
  return 'none'
}

// ── Empty state ────────────────────────────────────────────
function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
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

// ── Drawer form ────────────────────────────────────────────
const EMPTY_FORM = { first_name:'', last_name:'', email:'', title:'', department:'', employee_id:'' }

function RecipientDrawer({ issuerId, recipient, onClose, onSaved }) {
  const [form, setForm]       = useState(recipient ? { ...recipient } : { ...EMPTY_FORM })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const isEdit                = !!recipient

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.email) {
      setError('First name, last name, and email are required.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      first_name:  form.first_name.trim(),
      last_name:   form.last_name.trim(),
      email:       form.email.trim().toLowerCase(),
      title:       form.title.trim(),
      department:  form.department.trim(),
      employee_id: form.employee_id.trim(),
      issuer_id:   issuerId,
      is_active:   true,
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
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />
      {/* Drawer */}
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <h2 className="text-white font-semibold">{isEdit ? 'Edit Recipient' : 'Add Recipient'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5 px-6 py-6 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name *" value={form.first_name} onChange={v => set('first_name', v)} placeholder="Jane" />
            <Field label="Last Name *"  value={form.last_name}  onChange={v => set('last_name', v)}  placeholder="Smith" />
          </div>
          <Field label="Work Email *"   value={form.email}       onChange={v => set('email', v)}       placeholder="jane@organization.com" type="email" />
          <Field label="Title"          value={form.title}       onChange={v => set('title', v)}       placeholder="Physician, VP of Finance..." />
          <Field label="Department"     value={form.department}  onChange={v => set('department', v)}  placeholder="Emergency Medicine, HR..." />
          <Field label="Employee ID"    value={form.employee_id} onChange={v => set('employee_id', v)} placeholder="Optional" />

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">
              {error}
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-slate-800 flex gap-3">
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

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
      />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function Recipients() {
  const { profile } = useAuth()
  const issuerId    = profile?.issuer_id

  const [recipients, setRecipients] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing]       = useState(null)   // recipient obj or null
  const [inviting, setInviting]     = useState(null)   // recipient id being invited
  const [search, setSearch]         = useState('')

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

  function openAdd()        { setEditing(null); setDrawerOpen(true) }
  function openEdit(r)      { setEditing(r);    setDrawerOpen(true) }
  function closeDrawer()    { setDrawerOpen(false); setEditing(null) }
  function onSaved()        { closeDrawer(); load() }

  async function sendInvite(r) {
    setInviting(r.id)
    const { error } = await supabase.auth.admin.inviteUserByEmail(r.email, {
      data: { recipient_id: r.id, issuer_id: issuerId }
    })

    if (error) {
      // admin.inviteUserByEmail needs service_role key — flag for backend
      // For now, mark invite_sent_at optimistically and note limitation
      alert('Invite emails require a server-side function. This will be wired up in the next build. The recipient record is saved and ready.')
      setInviting(null)
      return
    }

    // Mark invite sent
    await supabase.from('recipients').update({ invite_sent_at: new Date().toISOString() }).eq('id', r.id)
    setInviting(null)
    load()
  }

  const filtered = recipients.filter(r => {
    const q = search.toLowerCase()
    return (
      r.first_name?.toLowerCase().includes(q) ||
      r.last_name?.toLowerCase().includes(q)  ||
      r.email?.toLowerCase().includes(q)      ||
      r.title?.toLowerCase().includes(q)      ||
      r.department?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-2xl font-semibold">Recipients</h1>
          <p className="text-slate-400 text-sm mt-1">
            {recipients.length > 0 ? `${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}` : 'No recipients yet'}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <PlusIcon className="w-4 h-4" /> Add Recipient
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Search */}
      {recipients.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, title, or department…"
            className="w-full max-w-sm bg-slate-900 border border-slate-800 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 && recipients.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
            No recipients match "{search}"
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                <th className="text-left px-6 py-3 font-medium">Recipient</th>
                <th className="text-left px-6 py-3 font-medium">Title / Dept</th>
                <th className="text-left px-6 py-3 font-medium">Agreements</th>
                <th className="text-left px-6 py-3 font-medium">Portal Access</th>
                <th className="text-right px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(r => {
                const status   = inviteStatus(r)
                const { label, cls } = STATUS[status]
                const agCount  = r.agreements?.length ?? 0
                return (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-3.5">
                      <p className="text-slate-200 font-medium">{r.first_name} {r.last_name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{r.email}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <p className="text-slate-300">{r.title || '—'}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{r.department || ''}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-slate-300 font-mono">{agCount}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {status === 'none' && (
                          <button
                            onClick={() => sendInvite(r)}
                            disabled={inviting === r.id}
                            className="flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 disabled:opacity-50 transition"
                          >
                            <MailIcon className="w-3.5 h-3.5" />
                            {inviting === r.id ? 'Sending…' : 'Invite'}
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(r)}
                          className="text-xs font-medium text-slate-400 hover:text-white transition px-2 py-1 rounded hover:bg-slate-700"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <RecipientDrawer
          issuerId={issuerId}
          recipient={editing}
          onClose={closeDrawer}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
