-- Rate limiting infrastructure for edge functions.
--
-- Pattern: each function call inserts a row tagged with the calling issuer_id
-- and the function name. Before doing real work, the function asks the DB
-- "have we exceeded our limit in the last N seconds?" The check + insert
-- happens in a single SQL function call so it's atomic.
--
-- Old rows are pruned by a small periodic cleanup (no pg_cron yet — for now,
-- the function itself trims rows older than 1 hour on each call to keep the
-- table small).

CREATE TABLE IF NOT EXISTS function_rate_limits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_id     uuid NOT NULL,
  function_name text NOT NULL,
  called_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS function_rate_limits_lookup
  ON function_rate_limits (issuer_id, function_name, called_at);

-- RLS: only admins read this table directly. Service role bypasses RLS so
-- edge functions still get full access for the check + insert.
ALTER TABLE function_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_rate_limits" ON function_rate_limits
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin'::user_role);

-- check_and_increment_rate_limit:
--   Returns true if the call is allowed (and logs it).
--   Returns false if the limit has been exceeded (call NOT logged).
--   Also opportunistically deletes rows older than 1 hour to prevent unbounded growth.
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_issuer_id     uuid,
  p_function_name text,
  p_max_calls     int,
  p_window_seconds int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  call_count int;
BEGIN
  -- Cleanup old rows (older than 1 hour) — bounded amortized cost.
  DELETE FROM function_rate_limits
  WHERE called_at < now() - INTERVAL '1 hour';

  -- Count calls within the rate-limit window.
  SELECT COUNT(*) INTO call_count
  FROM function_rate_limits
  WHERE issuer_id     = p_issuer_id
    AND function_name = p_function_name
    AND called_at     > now() - (p_window_seconds || ' seconds')::interval;

  IF call_count >= p_max_calls THEN
    RETURN false;
  END IF;

  INSERT INTO function_rate_limits (issuer_id, function_name)
  VALUES (p_issuer_id, p_function_name);

  RETURN true;
END;
$$;

-- Allow authenticated callers (the edge functions, called as service role) to invoke.
GRANT EXECUTE ON FUNCTION check_and_increment_rate_limit(uuid, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_rate_limit(uuid, text, int, int) TO service_role;
