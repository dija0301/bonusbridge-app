import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const PLAN_TIERS = [
  { value: 'manage',  label: 'Manage'  },
  { value: 'notify',  label: 'Notify'  },
  { value: 'execute', label: 'Execute' },
]

const FEATURES = [
  { key: 'state_law_engine',   label: 'State Law Engine'    },
  { key: 'notifications',      label: 'Notifications'       },
  { key: 'bulk_export',        label: 'Bulk Export'         },
  { key: 'departure_response', label: 'Departure Response'  },
  { key: 'docusign',           label: 'DocuSign'            },
]

const PLAN_STYLES = {
  manage:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
  notify:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  execute: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
}

function XIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
}

export default function AdminClients() {
  const [clients, setClients]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [features, setFeatures]     = useState({})
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [search, setSearch]         = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClient, setNewClient]   = useState({
    org_name: '', plan_tier: 'manage', admin_first_name: '', admin_last_name: '',
    admin_email: '', primary_contact_phone: '', contract_value: '', renewal_date: '',
  })
  const [creating, setCreating]     = useState(false)
  const [createError, setCreateError] = useState(null)
  const [createSuccess, setCreateSuccess] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('issuers')
      .select('*, agreements(id, status, principal_amount), recipients(id, is_active)')
      .order('name')
    setClients(data ?? [])
    setLoading(false)
  }

  async function createClient() {
    if (!newClient.org_name || !newClient.admin_email || !newClient.admin_first_name || !newClient.admin_last_name) {
      setCreateError('Organization name, admin first name, last name, and email are required.')
      return
    }
    setCreating(true)
    setCreateError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await supabase.functions.invoke('create-client', {
      body: newClient,
      headers: { Authorization: `Bearer ${session?.access_token}` }
    })
    setCreating(false)
    if (res.error || res.data?.error) {
      setCreateError(res.data?.error ?? res.error?.message)
      return
    }
    setCreateSuccess(`Client created! Welcome email sent to ${newClient.admin_email}.`)
    setNewClient({ org_name: '', plan_tier: 'manage', admin_first_name: '', admin_last_name: '', admin_email: '', primary_contact_phone: '', contract_value: '', renewal_date: '' })
    setTimeout(() => { setShowNewClient(false); setCreateSuccess(null) }, 3000)
    load()
  }
    setSelected(client)
    const { data } = await supabase
      .from('issuer_features')
      .select('feature, enabled')
      .eq('issuer_id', client.id)
    const featureMap = {}
    ;(data ?? []).forEach(f => { featureMap[f.feature] = f.enabled })
    setFeatures(featureMap)
  }

  async function saveClient() {
    setSaving(true)
    // Save issuer CRM fields
    await supabase.from('issuers').update({
      name:                  selected.name,
      plan_tier:             selected.plan_tier,
      primary_contact_name:  selected.primary_contact_name,
      primary_contact_email: selected.primary_contact_email,
      primary_contact_phone: selected.primary_contact_phone,
      contract_value:        selected.contract_value,
      renewal_date:          selected.renewal_date,
      onboarded_at:          selected.onboarded_at,
      is_active:             selected.is_active,
      admin_notes:           selected.admin_notes,
    }).eq('id', selected.id)

    // Save feature flags
    for (const [feature, enabled] of Object.entries(features)) {
      await supabase.from('issuer_features').upsert({
        issuer_id: selected.id, feature, enabled, updated_at: new Date().toISOString()
      })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    load()
  }

  function setS(k, v) { setSelected(s => ({ ...s, [k]: v })) }

  const filtered = clients.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Clients</h1>
          <p className="text-slate-400 text-sm mt-1">{clients.length} total clients</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-64 bg-slate-900 border border-slate-800 text-white placeholder-slate-500 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-brand-500 transition" />
          <button onClick={() => setShowNewClient(true)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            + New Client
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                <th className="text-left px-6 py-3 font-medium">Organization</th>
                <th className="text-left px-6 py-3 font-medium">Plan</th>
                <th className="text-left px-6 py-3 font-medium">Agreements</th>
                <th className="text-left px-6 py-3 font-medium">Recipients</th>
                <th className="text-left px-6 py-3 font-medium">Renewal</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(c => (
                <tr key={c.id} onClick={() => selectClient(c)}
                  className="hover:bg-slate-800/30 transition cursor-pointer">
                  <td className="px-6 py-3.5">
                    <p className="text-brand-400 font-medium">{c.name}</p>
                    {c.primary_contact_name && <p className="text-slate-500 text-xs">{c.primary_contact_name}</p>}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${PLAN_STYLES[c.plan_tier] ?? PLAN_STYLES.manage}`}>
                      {c.plan_tier ?? 'manage'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-300 font-mono">{c.agreements?.length ?? 0}</td>
                  <td className="px-6 py-3.5 text-slate-300 font-mono">{c.recipients?.length ?? 0}</td>
                  <td className="px-6 py-3.5 text-slate-400 text-xs">{fmtDate(c.renewal_date)}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Client Panel */}
      {showNewClient && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setShowNewClient(false)} />
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-white font-semibold">New Client</h2>
                <p className="text-slate-500 text-xs mt-0.5">Creates organization, admin user, and sends welcome email</p>
              </div>
              <button onClick={() => setShowNewClient(false)} className="text-slate-400 hover:text-white transition">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
              <Section title="Organization">
                <Field label="Organization Name" value={newClient.org_name} onChange={v => setNewClient(n => ({ ...n, org_name: v }))} placeholder="Allina Health" />
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1.5">Plan Tier</label>
                  <select value={newClient.plan_tier} onChange={e => setNewClient(n => ({ ...n, plan_tier: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition">
                    {PLAN_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Contract Value" type="number" value={newClient.contract_value} onChange={v => setNewClient(n => ({ ...n, contract_value: v }))} placeholder="0" />
                  <Field label="Renewal Date" type="date" value={newClient.renewal_date} onChange={v => setNewClient(n => ({ ...n, renewal_date: v }))} />
                </div>
              </Section>

              <Section title="Admin User">
                <p className="text-slate-500 text-xs -mt-2">This person will be the primary admin for the organization. They'll receive a welcome email with a link to set their password.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" value={newClient.admin_first_name} onChange={v => setNewClient(n => ({ ...n, admin_first_name: v }))} placeholder="Jane" />
                  <Field label="Last Name" value={newClient.admin_last_name} onChange={v => setNewClient(n => ({ ...n, admin_last_name: v }))} placeholder="Smith" />
                </div>
                <Field label="Email" type="email" value={newClient.admin_email} onChange={v => setNewClient(n => ({ ...n, admin_email: v }))} placeholder="jane@orgname.com" />
                <Field label="Phone (optional)" type="tel" value={newClient.primary_contact_phone} onChange={v => setNewClient(n => ({ ...n, primary_contact_phone: v }))} placeholder="(612) 555-0101" />
              </Section>

              {createError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">{createError}</div>
              )}
              {createSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg px-3.5 py-2.5">{createSuccess}</div>
              )}
            </div>

            <div className="shrink-0 px-5 py-4 border-t border-slate-800 flex gap-3">
              <button onClick={() => setShowNewClient(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
                Cancel
              </button>
              <button onClick={createClient} disabled={creating}
                className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium transition">
                {creating ? 'Creating…' : 'Create Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setSelected(null)} />
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-white font-semibold">{selected.name}</h2>
                <p className="text-slate-500 text-xs mt-0.5">Client Record</p>
              </div>
              <div className="flex items-center gap-3">
                {saved && <span className="text-emerald-400 text-xs font-medium">Saved</span>}
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white transition">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

              {/* Organization */}
              <Section title="Organization">
                <Field label="Name" value={selected.name} onChange={v => setS('name', v)} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 text-xs font-medium mb-1.5">Plan Tier</label>
                    <select value={selected.plan_tier ?? 'manage'} onChange={e => setS('plan_tier', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition">
                      {PLAN_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <Field label="Contract Value" type="number" value={selected.contract_value}
                    onChange={v => setS('contract_value', v)} placeholder="0" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Onboarded Date" type="date" value={selected.onboarded_at}
                    onChange={v => setS('onboarded_at', v)} />
                  <Field label="Renewal Date" type="date" value={selected.renewal_date}
                    onChange={v => setS('renewal_date', v)} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!selected.is_active}
                    onChange={e => setS('is_active', e.target.checked)}
                    className="w-4 h-4 rounded" />
                  <span className="text-slate-300 text-sm">Active client</span>
                </label>
              </Section>

              {/* Primary contact */}
              <Section title="Primary Contact">
                <Field label="Name" value={selected.primary_contact_name}
                  onChange={v => setS('primary_contact_name', v)} placeholder="Jane Smith" />
                <Field label="Email" type="email" value={selected.primary_contact_email}
                  onChange={v => setS('primary_contact_email', v)} placeholder="jane@org.com" />
                <Field label="Phone" type="tel" value={selected.primary_contact_phone}
                  onChange={v => setS('primary_contact_phone', v)} placeholder="(612) 555-0101" />
              </Section>

              {/* Feature flags */}
              <Section title="Feature Flags">
                <p className="text-slate-500 text-xs -mt-2">Enable or disable features for this client based on their plan</p>
                <div className="flex flex-col gap-3">
                  {FEATURES.map(f => (
                    <label key={f.key} className="flex items-center justify-between cursor-pointer">
                      <span className="text-slate-300 text-sm">{f.label}</span>
                      <div className="relative shrink-0">
                        <input type="checkbox" className="sr-only"
                          checked={!!features[f.key]}
                          onChange={e => setFeatures(prev => ({ ...prev, [f.key]: e.target.checked }))} />
                        <div className={`w-9 h-5 rounded-full transition ${features[f.key] ? 'bg-brand-600' : 'bg-slate-700'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${features[f.key] ? 'translate-x-4' : ''}`} />
                      </div>
                    </label>
                  ))}
                </div>
              </Section>

              {/* Portfolio summary */}
              <Section title="Portfolio Summary">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Total Agreements</p>
                    <p className="text-slate-200 text-sm font-mono">{selected.agreements?.length ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Active Agreements</p>
                    <p className="text-slate-200 text-sm font-mono">{selected.agreements?.filter(a => a.status === 'active').length ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Total Recipients</p>
                    <p className="text-slate-200 text-sm font-mono">{selected.recipients?.length ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Total Portfolio</p>
                    <p className="text-slate-200 text-sm font-mono">{fmt(selected.agreements?.reduce((s, a) => s + (parseFloat(a.principal_amount) || 0), 0))}</p>
                  </div>
                </div>
              </Section>

              {/* Admin notes */}
              <Section title="Admin Notes">
                <textarea value={selected.admin_notes ?? ''} onChange={e => setS('admin_notes', e.target.value)}
                  placeholder="Internal notes about this client — sales context, support history, renewal notes…"
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition resize-none" />
              </Section>
            </div>

            <div className="shrink-0 px-5 py-4 border-t border-slate-800 flex gap-3">
              <button onClick={() => setSelected(null)}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
                Cancel
              </button>
              <button onClick={saveClient} disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium transition">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{title}</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-slate-300 text-xs font-medium mb-1.5">{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition" />
    </div>
  )
}
