-- Two cleanups:
--   1. Remove orphan profile row that has no corresponding auth.users entry
--      (a stray duplicate of dija0301@gmail.com from earlier testing).
--   2. Add admin override RLS policies on every multi-tenant table so the
--      superadmin can see/edit data across all issuers. Existing role-based
--      policies stay in place — these are additive, not destructive.

-- ── 1. Orphan profile cleanup ─────────────────────────────
DELETE FROM profiles
WHERE id = '48d3de7e-327d-4236-8b9b-8766287eb051';

-- ── 2. Admin override policies ────────────────────────────
-- One per table. PostgreSQL OR's all policies together, so existing
-- issuer/recipient policies remain unaffected.

CREATE POLICY "admin_all_issuers" ON issuers
  FOR ALL TO authenticated
  USING (auth_role() = 'admin'::user_role)
  WITH CHECK (auth_role() = 'admin'::user_role);

CREATE POLICY "admin_all_agreements" ON agreements
  FOR ALL TO authenticated
  USING (auth_role() = 'admin'::user_role)
  WITH CHECK (auth_role() = 'admin'::user_role);

CREATE POLICY "admin_all_recipients" ON recipients
  FOR ALL TO authenticated
  USING (auth_role() = 'admin'::user_role)
  WITH CHECK (auth_role() = 'admin'::user_role);

CREATE POLICY "admin_all_profiles" ON profiles
  FOR ALL TO authenticated
  USING (auth_role() = 'admin'::user_role)
  WITH CHECK (auth_role() = 'admin'::user_role);

CREATE POLICY "admin_all_amortization_schedule" ON amortization_schedule
  FOR ALL TO authenticated
  USING (auth_role() = 'admin'::user_role)
  WITH CHECK (auth_role() = 'admin'::user_role);

CREATE POLICY "admin_all_notification_settings" ON notification_settings
  FOR ALL TO authenticated
  USING (auth_role() = 'admin'::user_role)
  WITH CHECK (auth_role() = 'admin'::user_role);

CREATE POLICY "admin_all_recipient_events" ON recipient_events
  FOR ALL TO authenticated
  USING (auth_role() = 'admin'::user_role)
  WITH CHECK (auth_role() = 'admin'::user_role);
