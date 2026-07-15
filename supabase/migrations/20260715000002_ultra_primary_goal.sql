-- Phase 3 (ultra): add the ultra primary goal. Additive + idempotent.
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'ultra';
