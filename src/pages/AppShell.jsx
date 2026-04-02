import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ISSUER_NAV = [
  { to: '/issuer',             label: 'Overview',    icon: OverviewIcon },
  { to: '/issuer/agreements',  label: 'Agreements',  icon: AgreementsIcon },
  { to: '/issuer/recipients',  label: 'Recipients',  icon: RecipientsIcon },
  { to: '/issuer/collections', label: 'Collections', icon: CollectionsIcon },
]

const RECIPIENT_NAV = [
  { to: '/recipient', label: 'My Agreement', icon: AgreementsIcon },
]

const ADMIN_NAV = [
  { to: '/admin', label: 'Admin', icon: OverviewIcon },
]

const roleNav = {
  issuer_admin: ISSUER_NAV,
  issuer_user:  ISSUER_NAV,
  recipient:    RECIPIENT_NAV,
}

export default function AppShell() {
  const { profile, role, displayName, signOut } = useAuth()
  const navigate = useNavigate()
  const nav = roleNav[role] ?? ISSUER_NAV

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">
        {/* Wordmark */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800">
          <div className="flex items-center justify-center shrink-0">
            <svg width="34" height="21" viewBox="0 0 80 44" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          </div>
          <span className="text-white font-semibold text-base tracking-tight">BonusBridge</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/issuer' || to === '/recipient' || to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ` +
                (isActive
                  ? 'bg-brand-600/15 text-brand-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800')
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3 py-2 mb-1">
            <p className="text-slate-200 text-sm font-medium truncate">
              {displayName ?? '—'}
            </p>
            <p className="text-slate-500 text-xs capitalize">{role}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/5 text-sm font-medium transition"
          >
            <SignOutIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

// ── Icons (inline SVG, no dep needed) ──────────────────────────

function OverviewIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1"/>
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1"/>
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1"/>
      <rect x="9" y="9" width="5.5" height="5.5" rx="1"/>
    </svg>
  )
}

function AgreementsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
      <path d="M10 2v3h3"/>
      <path d="M5 7h6M5 10h4"/>
    </svg>
  )
}

function RecipientsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="2.5"/>
      <path d="M2 13c0-2.8 2.7-5 6-5s6 2.2 6 5"/>
    </svg>
  )
}

function CollectionsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M2 8h12M2 12h7"/>
      <circle cx="13" cy="12" r="2"/>
      <path d="M12 12h-1M13 11v-1"/>
    </svg>
  )
}

function SignOutIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>
      <path d="M11 11l3-3-3-3M14 8H6"/>
    </svg>
  )
}
