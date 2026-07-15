-- Phase 2c-i-a: make cycling a selectable primary goal.
--
-- Mirrors the swim/rowing/hyrox addition (20260714000003) and the triathlon
-- precedent (20260702000021). session_type_enum already has 'bike'
-- (20260702000015), so bike sessions store fine — only primary_goal_enum needs
-- the new value. ADD VALUE IF NOT EXISTS is idempotent and backward-compatible.
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'cycling';
