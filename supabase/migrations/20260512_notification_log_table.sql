-- notification_log: record of every email the platform sends on an issuer's behalf.
-- Used for (a) deduplication (don't send the same forgiveness reminder twice for the
-- same period) and (b) audit visibility (issuer can see what was sent when).
--
-- An older stub table existed from a prior session with columns event_type/event_date —
-- we drop and recreate since nothing's been logged there yet.
--
-- Inserts happen from the send-notifications edge function running as service_role,
-- so no INSERT policies are needed (service_role bypasses RLS).

DROP TABLE IF EXISTS notification_log CASCADE;

CREATE TABLE notification_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_id         uuid NOT NULL REFERENCES issuers(id) ON DELETE CASCADE,
  recipient_id      uuid REFERENCES recipients(id) ON DELETE SET NULL,
  agreement_id      uuid REFERENCES agreements(id) ON DELETE SET NULL,
  notification_type text NOT NULL,           -- 'forgiveness_reminder', future: 'acknowledgment_reminder', etc.
  subtype           text,                    -- e.g. 'period-5' so we dedupe per-period
  sent_to_email     text NOT NULL,
  sent_to_role     text NOT NULL,            -- 'recipient' or 'issuer'
  subject           text,
  status            text NOT NULL DEFAULT 'sent',  -- 'sent' | 'failed' | 'skipped_opted_out'
  error_message     text,
  sent_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_log_dedupe_lookup
  ON notification_log (notification_type, subtype, agreement_id);

CREATE INDEX notification_log_issuer_sent
  ON notification_log (issuer_id, sent_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_notification_log ON notification_log
  FOR ALL TO authenticated
  USING (auth_role() = 'admin'::user_role)
  WITH CHECK (auth_role() = 'admin'::user_role);

CREATE POLICY notification_log_issuer_read ON notification_log
  FOR SELECT TO authenticated
  USING (
    issuer_id = current_user_issuer_id()
    AND current_user_role() = ANY (ARRAY['issuer_admin'::user_role, 'issuer_user'::user_role])
  );
