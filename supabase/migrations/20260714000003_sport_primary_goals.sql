-- Phase 2b-i: make swim / rowing / hyrox selectable primary goals.
--
-- Phase 2a built training zones for swim (CSS), rowing (2k split), and hyrox
-- (run-threshold) — but they were DORMANT: primary_goal_enum could not hold
-- these values, so blueprintSport() never resolved to them and computeEnvelope
-- never dispatched to those branches. Adding the enum values activates the 2a
-- zone engine + pace-clamp end-to-end.
--
-- Mirrors the triathlon precedent (20260702000021) and the session_type
-- additions (20260702000015 swim/bike, 20260707000028 rowing/hyrox).
-- ADD VALUE IF NOT EXISTS is idempotent and backward-compatible: existing rows
-- and queries are unaffected.
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'swim';
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'rowing';
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'hyrox';
