-- 031_friend_search_by_phone.sql
-- Adds phone-number friend search alongside the existing email search.
-- Same trust model as search_user_by_email: self-reported, unverified,
-- exact match only — "add someone you know the number of," not a directory
-- browse or contacts-list sync.

-- Stored (and searched) as E.164 ("+15551234567") — normalized client-side
-- before ever reaching the database, so an exact string match is reliable.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT
  CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{7,14}$');

-- Only enforced once a user actually sets a number; NULLs (the default,
-- and everyone who never sets one) don't collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

-- ── RPC: search_user_by_phone ─────────────────────────────────────────────
-- Mirrors search_user_by_email (029) — SECURITY DEFINER since `users` RLS
-- restricts reads to the caller's own row.
CREATE OR REPLACE FUNCTION search_user_by_phone(p_phone TEXT)
RETURNS TABLE(
  user_id           UUID,
  display_name      TEXT,
  friendship_status TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id AS user_id,
    u.display_name,
    (
      SELECT f.status::text
      FROM friendships f
      WHERE (f.requester_id = auth.uid() AND f.addressee_id = u.id)
         OR (f.addressee_id = auth.uid() AND f.requester_id = u.id)
      LIMIT 1
    ) AS friendship_status
  FROM users u
  WHERE u.phone = p_phone
    AND u.deleted_at IS NULL
    AND u.id != auth.uid();
$$;

GRANT EXECUTE ON FUNCTION search_user_by_phone TO authenticated;
