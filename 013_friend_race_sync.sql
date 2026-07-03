-- 013_friend_race_sync.sql
-- Friend event sync (lite) — Task 9.
-- Adds race_partners table so users can flag training partners at shared races,
-- plus two SECURITY DEFINER RPC functions for cross-user profile lookups
-- (users table is restricted to self-only reads under RLS).

-- ── race_partners ─────────────────────────────────────────────────────────────
-- Records that the race owner wants to train alongside a specific friend
-- who is also racing on (or near) the same date.

CREATE TABLE IF NOT EXISTS race_partners (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id          UUID NOT NULL REFERENCES race_events(id) ON DELETE CASCADE,
  partner_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(race_id, partner_user_id)
);

CREATE INDEX IF NOT EXISTS idx_race_partners_race ON race_partners(race_id);

ALTER TABLE race_partners ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON race_partners TO authenticated;
GRANT ALL ON race_partners TO service_role;

-- Only the owner of the race can see or manage its partners.
CREATE POLICY race_partners_owner ON race_partners
  FOR ALL TO authenticated
  USING (
    race_id IN (
      SELECT id FROM race_events WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    race_id IN (
      SELECT id FROM race_events WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- ── RPC: get_friends_at_race ──────────────────────────────────────────────────
-- Returns accepted friends who have at least one upcoming race on p_event_date.
-- SECURITY DEFINER so it can join across users and race_events despite their
-- self-only RLS policies.

-- Drop the old (p_user_id, p_event_date) signature in case this migration is
-- re-run after an earlier deploy of the insecure version — CREATE OR REPLACE
-- cannot change a function's argument list, so the vulnerable overload would
-- otherwise remain callable.
DROP FUNCTION IF EXISTS get_friends_at_race(UUID, DATE);

CREATE OR REPLACE FUNCTION get_friends_at_race(
  p_event_date DATE
)
RETURNS TABLE(
  friend_user_id       UUID,
  friend_display_name  TEXT,
  friend_race_id       UUID,
  friend_race_name     TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id              AS friend_user_id,
    u.display_name    AS friend_display_name,
    re.id             AS friend_race_id,
    re.name           AS friend_race_name
  FROM friendships f
  JOIN users u ON u.id = CASE
    WHEN f.requester_id = auth.uid() THEN f.addressee_id
    ELSE f.requester_id
  END
  JOIN race_events re
    ON  re.user_id    = u.id
    AND re.event_date = p_event_date
    AND re.deleted_at IS NULL
  WHERE f.status = 'accepted'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    AND u.deleted_at IS NULL
  ORDER BY u.display_name;
$$;

GRANT EXECUTE ON FUNCTION get_friends_at_race TO authenticated;

-- ── RPC: get_race_partners ────────────────────────────────────────────────────
-- Returns the display names of all partners already added to a given race.
-- SECURITY DEFINER for the same cross-user read reason.

CREATE OR REPLACE FUNCTION get_race_partners(p_race_id UUID)
RETURNS TABLE(
  partner_user_id       UUID,
  partner_display_name  TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    rp.partner_user_id,
    u.display_name AS partner_display_name
  FROM race_partners rp
  JOIN users u ON u.id = rp.partner_user_id
  WHERE rp.race_id = p_race_id
    -- Security: only the race owner or a flagged partner may see the partner list.
    AND (
      rp.race_id IN (SELECT id FROM race_events WHERE user_id = auth.uid() AND deleted_at IS NULL)
      OR rp.partner_user_id = auth.uid()
    )
  ORDER BY u.display_name;
$$;

GRANT EXECUTE ON FUNCTION get_race_partners TO authenticated;
