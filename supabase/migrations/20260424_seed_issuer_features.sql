-- Seed issuer_features with sensible defaults for every existing issuer.
-- Uses NOT EXISTS instead of ON CONFLICT so this works whether or not there's
-- a unique constraint on (issuer_id, feature).
--
-- Defaults: everything ON except DocuSign and Plaid (premium/future tiers).
-- Exception: Meridian Health System demo gets DocuSign ON so the demo shows
-- the full premium experience.

INSERT INTO issuer_features (issuer_id, feature, enabled, updated_at)
SELECT i.id, f.feature, f.default_enabled, now()
FROM issuers i
CROSS JOIN (VALUES
  ('state_law_engine',   true),
  ('notifications',      true),
  ('bulk_export',        true),
  ('departure_response', true),
  ('docusign',           false),
  ('plaid_verification', false)
) AS f(feature, default_enabled)
WHERE NOT EXISTS (
  SELECT 1 FROM issuer_features existing
  WHERE existing.issuer_id = i.id AND existing.feature = f.feature
);

-- Meridian Health System demo: DocuSign ON so the full demo experience works.
UPDATE issuer_features
SET enabled = true, updated_at = now()
WHERE issuer_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  AND feature = 'docusign';
