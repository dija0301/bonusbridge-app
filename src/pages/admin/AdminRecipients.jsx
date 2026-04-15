import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const daysSince = d => {
  if (!d) return null
  const days = Math.floor((new Date() - new Date(d)) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export default function AdminRecipients() {
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [sortCol, setSortCol]       = useState('last_name')
  const [sortDir, setSortDir]       = useState('asc')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('recipients')
      .select('*, issuers(name), agreements(id, status)')
      .order('last_name')
    setRecipients(data ?? [])
    setLoading(false)
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortIcon(col) {
    if (sortCol !== col) return <span className="text-slate-600 ml-1">↕</span>
    return <span className="text-brand-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const filtered = recipients
    .filter(r => {
      const q = search.toLowerCase()
      return !q || `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) || r.issuers?.name?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      let av, bv
      if (sortCol === 'name') { av = `${a.last_name} ${a.first_name}`; bv = `${b.last_name} ${b.first_name}` }
      else if (sortCol === 'org') { av = a.issuers?.name ?? ''; bv = b.issuers?.name ?? '' }
      else { av = a[sortCol] ?? ''; bv = b[sortCol] ?? '' }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">All Recipients</h1>
          <p className="text-slate-400 text-sm mt-1">{recipients.length} total recipients across all clients</p>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or client…"
          className="w-72 bg-slate-900 border border-slate-800 text-white placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('name')}>Recipient{sortIcon('name')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('org')}>Client{sortIcon('org')}</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-5 py-3 font-medium">Agreements</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('onboarding_complete')}>Onboarded{sortIcon('onboarding_complete')}</th>
                  <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('last_login_at')}>Last Login{sortIcon('last_login_at')}</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5">
                      <p className="text-slate-200 font-medium">{r.first_name} {r.last_name}</p>
                      {r.title && <p className="text-slate-500 text-xs">{r.title}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{r.issuers?.name ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-300 text-xs">{r.email}</p>
                      {r.personal_email && <p className="text-slate-500 text-xs">{r.personal_email}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono text-xs">{r.agreements?.length ?? 0}</td>
                    <td className="px-5 py-3.5">
                      {r.onboarding_complete
                        ? <span className="text-emerald-400 text-xs">✓ Complete</span>
                        : <span className="text-slate-600 text-xs italic">Pending</span>
                      }
                    </td>
                    <td className="px-5 py-3.5">
                      {r.last_login_at
                        ? <div>
                            <p className="text-slate-300 text-xs">{fmtDate(r.last_login_at)}</p>
                            <p className="text-slate-500 text-xs">{daysSince(r.last_login_at)}</p>
                          </div>
                        : <span className="text-slate-600 text-xs italic">Never</span>
                      }
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${r.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {r.user_id && (
                        <a
                          href={`/recipient?preview_recipient=${r.user_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-400 hover:text-brand-300 text-xs font-medium transition">
                          View as Recipient →
                        </a>
                      )}
                      {!r.user_id && (
                        <span className="text-slate-600 text-xs italic">No portal access</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
