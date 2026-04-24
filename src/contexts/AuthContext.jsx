import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Every feature flag the app knows about. Default reflects the expected baseline
// for a newly-onboarded client if no rows exist in issuer_features yet.
const DEFAULT_FEATURES = {
  state_law_engine:   true,
  notifications:      true,
  bulk_export:        true,
  departure_response: true,
  docusign:           false,
  plaid_verification: false,
}

export function AuthProvider({ children }) {
  const [session, setSession]           = useState(undefined)
  const [profile, setProfile]           = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [features, setFeatures]         = useState(DEFAULT_FEATURES)
  const [previewIssuerId, setPreviewIssuerId] = useState(null)
  const [previewIssuer, setPreviewIssuer]     = useState(null)

  // Check for preview_issuer query param on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('preview_issuer')
    if (pid) {
      setPreviewIssuerId(pid)
      supabase.from('issuers').select('id, name').eq('id', pid).single().then(({ data }) => {
        if (data) setPreviewIssuer(data)
      })
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setSession(null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setSession(null); setProfile(null); return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session)
        if (session) fetchProfile(session.user.id)
        return
      }
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setSession(null); setProfile(null) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, issuers(id, name)')
        .eq('id', userId)
        .single()
      if (error) throw error
      setProfile(data)
    } catch {
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }

  // Load issuer_features for the currently-effective issuer (preview or own).
  // Missing rows fall back to DEFAULT_FEATURES so nothing breaks for issuers
  // who haven't been seeded yet.
  useEffect(() => {
    const effectiveIssuerId = previewIssuerId || profile?.issuer_id
    if (!effectiveIssuerId) {
      setFeatures(DEFAULT_FEATURES)
      return
    }
    supabase
      .from('issuer_features')
      .select('feature, enabled')
      .eq('issuer_id', effectiveIssuerId)
      .then(({ data }) => {
        const flags = { ...DEFAULT_FEATURES }
        ;(data ?? []).forEach(row => { flags[row.feature] = row.enabled })
        setFeatures(flags)
      })
  }, [profile?.issuer_id, previewIssuerId])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null); setProfile(null)
  }

  // If admin is previewing a client, override role and issuer_id
  const isPreviewMode = !!previewIssuerId && profile?.role === 'admin'
  const effectiveProfile = isPreviewMode
    ? { ...profile, role: 'issuer_admin', issuer_id: previewIssuerId, issuers: previewIssuer }
    : profile

  const role        = effectiveProfile?.role ?? null
  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email
    : null
  const loading     = session === undefined || (!!session && profileLoading)

  return (
    <AuthContext.Provider value={{
      session, profile: effectiveProfile, role, displayName,
      signIn, signOut, loading,
      isPreviewMode, previewIssuer,
      features,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
