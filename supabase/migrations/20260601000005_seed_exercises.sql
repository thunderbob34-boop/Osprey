-- ============================================================
-- OSPREY 005 — Re-seed exercises
-- The exercises table came back empty: the seed INSERT in
-- 001_initial_schema.sql never landed (migration was likely run
-- in parts before reaching this block). Safe to re-run — `name`
-- is UNIQUE, so ON CONFLICT DO NOTHING makes this idempotent.
-- ============================================================

INSERT INTO exercises (name, muscle_group, equipment) VALUES
  ('Back Squat',       'Legs',       'Barbell'),
  ('Deadlift',         'Full Body',  'Barbell'),
  ('Bench Press',      'Chest',      'Barbell'),
  ('Pull-Up',          'Back',       'Bodyweight'),
  ('Romanian Deadlift','Hamstrings', 'Barbell'),
  ('Hip Thrust',       'Glutes',     'Barbell'),
  ('Calf Raise',       'Calves',     'Machine'),
  ('Plank',            'Core',       'Bodyweight'),
  ('Box Jump',         'Power',      'Plyometric'),
  ('Tempo Run',        'Cardio',     'None'),
  ('Strides',          'Cardio',     'None'),
  ('Foam Roll',        'Recovery',   'None')
ON CONFLICT (name) DO NOTHING;
