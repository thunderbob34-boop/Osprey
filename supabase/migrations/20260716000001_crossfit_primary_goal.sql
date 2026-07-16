-- Phase 3 (crossfit): add the crossfit primary goal. Additive + idempotent.
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'crossfit';
