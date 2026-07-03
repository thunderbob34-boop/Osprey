-- 021_triathlon_goal.sql
-- Adds 'triathlon' as a primary_goal_enum value so multisport athletes get
-- a dedicated plan-generation path instead of being forced into 'hybrid'.
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as a
-- statement that USES the new value, so this migration only adds it —
-- later migrations/functions reference it separately.

ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'triathlon';
