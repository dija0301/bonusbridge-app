-- Cleanup pass to remove stale demo orgs and test data.
--
-- KEEPS:
--   - Meridian Health System (aaaaaaaa-0000-0000-0000-000000000001) — the demo
--   - The BonusBridge LLC      (d90aa706-34cd-4599-b433-6f0e1dacb767) — admin org
--   - The dija0301@gmail.com admin profile
--
-- DELETES:
--   - 7 stale issuers (5 "BonusBridge Demo" dupes + 1 "Client Org Name" placeholder + 1 "The Bonus Bridge" stale test)
--   - All their agreements, recipients, schedules, events, settings, features
--   - Test admin profiles tied to those issuers (auth.users orphans cleaned in a separate pass)
--   - All 7 agreements + 5 recipients on The BonusBridge LLC (Jakob confirmed not real)

-- ── Phase 1: empty out The BonusBridge LLC (keep the issuer, just wipe its data) ──

DELETE FROM amortization_schedule
WHERE agreement_id IN (
  SELECT id FROM agreements
  WHERE issuer_id = 'd90aa706-34cd-4599-b433-6f0e1dacb767'
);

DELETE FROM recipient_events
WHERE issuer_id = 'd90aa706-34cd-4599-b433-6f0e1dacb767';

DELETE FROM agreements
WHERE issuer_id = 'd90aa706-34cd-4599-b433-6f0e1dacb767';

DELETE FROM recipients
WHERE issuer_id = 'd90aa706-34cd-4599-b433-6f0e1dacb767';

-- ── Phase 2: delete child data of stale issuers, in dependency order ──
-- Stale issuer IDs are inlined into each DELETE because the Supabase SQL Editor
-- runs each statement in a separate session (temp tables don't persist).

DELETE FROM amortization_schedule
WHERE agreement_id IN (
  SELECT id FROM agreements
  WHERE issuer_id IN (
    '0b83fda2-5fba-4b60-8e2e-2a1ff7655756',
    'ba52de11-9827-4bab-9a68-1a0a82067ca5',
    '6feb5dc1-dc23-4bdd-b056-198388b847bb',
    '6fe3e3b7-4edb-44a8-a6c5-54442cb5624e',
    '8f306cc1-7508-4ced-9d51-b8c7925395b6',
    '1f10e60f-1c25-4ba3-b390-24c61d88a876',
    '3bbb5389-31d6-4a08-9919-ef704cff8929'
  )
);

DELETE FROM recipient_events
WHERE issuer_id IN (
  '0b83fda2-5fba-4b60-8e2e-2a1ff7655756',
  'ba52de11-9827-4bab-9a68-1a0a82067ca5',
  '6feb5dc1-dc23-4bdd-b056-198388b847bb',
  '6fe3e3b7-4edb-44a8-a6c5-54442cb5624e',
  '8f306cc1-7508-4ced-9d51-b8c7925395b6',
  '1f10e60f-1c25-4ba3-b390-24c61d88a876',
  '3bbb5389-31d6-4a08-9919-ef704cff8929'
);

DELETE FROM agreements
WHERE issuer_id IN (
  '0b83fda2-5fba-4b60-8e2e-2a1ff7655756',
  'ba52de11-9827-4bab-9a68-1a0a82067ca5',
  '6feb5dc1-dc23-4bdd-b056-198388b847bb',
  '6fe3e3b7-4edb-44a8-a6c5-54442cb5624e',
  '8f306cc1-7508-4ced-9d51-b8c7925395b6',
  '1f10e60f-1c25-4ba3-b390-24c61d88a876',
  '3bbb5389-31d6-4a08-9919-ef704cff8929'
);

DELETE FROM recipients
WHERE issuer_id IN (
  '0b83fda2-5fba-4b60-8e2e-2a1ff7655756',
  'ba52de11-9827-4bab-9a68-1a0a82067ca5',
  '6feb5dc1-dc23-4bdd-b056-198388b847bb',
  '6fe3e3b7-4edb-44a8-a6c5-54442cb5624e',
  '8f306cc1-7508-4ced-9d51-b8c7925395b6',
  '1f10e60f-1c25-4ba3-b390-24c61d88a876',
  '3bbb5389-31d6-4a08-9919-ef704cff8929'
);

DELETE FROM notification_settings
WHERE issuer_id IN (
  '0b83fda2-5fba-4b60-8e2e-2a1ff7655756',
  'ba52de11-9827-4bab-9a68-1a0a82067ca5',
  '6feb5dc1-dc23-4bdd-b056-198388b847bb',
  '6fe3e3b7-4edb-44a8-a6c5-54442cb5624e',
  '8f306cc1-7508-4ced-9d51-b8c7925395b6',
  '1f10e60f-1c25-4ba3-b390-24c61d88a876',
  '3bbb5389-31d6-4a08-9919-ef704cff8929'
);

DELETE FROM issuer_features
WHERE issuer_id IN (
  '0b83fda2-5fba-4b60-8e2e-2a1ff7655756',
  'ba52de11-9827-4bab-9a68-1a0a82067ca5',
  '6feb5dc1-dc23-4bdd-b056-198388b847bb',
  '6fe3e3b7-4edb-44a8-a6c5-54442cb5624e',
  '8f306cc1-7508-4ced-9d51-b8c7925395b6',
  '1f10e60f-1c25-4ba3-b390-24c61d88a876',
  '3bbb5389-31d6-4a08-9919-ef704cff8929'
);

-- Stale admin profiles for those orgs — never delete dija0301's admin profile
DELETE FROM profiles
WHERE issuer_id IN (
  '0b83fda2-5fba-4b60-8e2e-2a1ff7655756',
  'ba52de11-9827-4bab-9a68-1a0a82067ca5',
  '6feb5dc1-dc23-4bdd-b056-198388b847bb',
  '6fe3e3b7-4edb-44a8-a6c5-54442cb5624e',
  '8f306cc1-7508-4ced-9d51-b8c7925395b6',
  '1f10e60f-1c25-4ba3-b390-24c61d88a876',
  '3bbb5389-31d6-4a08-9919-ef704cff8929'
)
AND id != '18e0e4d9-4322-4906-9cb0-9a7be40c1cdf';

-- ── Phase 3: delete the stale issuers themselves ──

DELETE FROM issuers
WHERE id IN (
  '0b83fda2-5fba-4b60-8e2e-2a1ff7655756',
  'ba52de11-9827-4bab-9a68-1a0a82067ca5',
  '6feb5dc1-dc23-4bdd-b056-198388b847bb',
  '6fe3e3b7-4edb-44a8-a6c5-54442cb5624e',
  '8f306cc1-7508-4ced-9d51-b8c7925395b6',
  '1f10e60f-1c25-4ba3-b390-24c61d88a876',
  '3bbb5389-31d6-4a08-9919-ef704cff8929'
);
