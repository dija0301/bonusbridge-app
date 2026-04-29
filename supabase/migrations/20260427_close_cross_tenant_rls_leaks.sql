-- Week 1, Day 1: close the actual cross-tenant data leaks on the recipients
-- and recipient_events tables. Existing properly-scoped policies remain in
-- place; we just drop the loose ones that were OR'ing themselves into
-- "anyone logged in can do anything."
--
-- Concretely fixed in this migration:
--   1. Any logged-in user could SELECT every recipient across all issuers.
--   2. Any logged-in user could UPDATE any recipient across all issuers.
--   3. Any logged-in user could INSERT a recipient row.
--   4. Any logged-in user could INSERT recipient_events for any recipient.
--
-- After this migration, the policies that remain enforce:
--   - admin (via admin_all_recipients) — full access across orgs
--   - issuer_admin / issuer_user (recipients_issuer_*) — own org only
--   - recipient (recipients_select_self / recipients_self_update added below) — own row only
--
-- Duplicate policy cleanup (e.g. agreements_insert vs agreements_issuer_insert)
-- is deferred — those duplicates are equivalent and harmless, just cluttered.

-- ── Recipients: close the three loose policies ──

DROP POLICY IF EXISTS recipients_select_issuer ON recipients;
DROP POLICY IF EXISTS recipients_update        ON recipients;
DROP POLICY IF EXISTS recipients_insert        ON recipients;

-- Replacement: let recipients update their own row only (their own contact info).
-- The contact editor in the recipient portal needs this to keep working.
CREATE POLICY recipients_self_update ON recipients
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND auth_role() = 'recipient'::user_role)
  WITH CHECK (user_id = auth.uid() AND auth_role() = 'recipient'::user_role);

-- ── Recipient events: tighten the loose insert ──
-- Allow inserts only when the inserter is either:
--   (a) an issuer admin/user inserting an event for one of their org's recipients, OR
--   (b) the recipient themselves inserting an event about their own row.

DROP POLICY IF EXISTS recipient_events_insert_self ON recipient_events;

CREATE POLICY recipient_events_insert_scoped ON recipient_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      issuer_id = current_user_issuer_id()
      AND current_user_role() = ANY (ARRAY['issuer_admin'::user_role, 'issuer_user'::user_role])
    )
    OR
    (
      recipient_id IN (SELECT id FROM recipients WHERE user_id = auth.uid())
      AND auth_role() = 'recipient'::user_role
    )
  );
