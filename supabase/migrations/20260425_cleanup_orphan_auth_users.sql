-- Cleanup pass to remove orphaned auth.users entries.
-- These are login records (auth.users) that no longer have a corresponding
-- profile or recipient pointing at them — left over from deleted demo orgs
-- and the duplicate-profile cleanup.
--
-- IMPORTANT: this DELETE is strict and only removes auth users with NO
-- profile row AND NO recipient row pointing at them. dija0301@gmail.com
-- has a profile, so it's safe.

DELETE FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
  AND id NOT IN (
    SELECT user_id FROM recipients WHERE user_id IS NOT NULL
  );
