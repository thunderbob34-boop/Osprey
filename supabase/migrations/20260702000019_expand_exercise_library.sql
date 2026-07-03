-- 019_expand_exercise_library.sql
-- The exercise library only had 12 movements (barely enough for a Hevy
-- replacement's exercise picker). Adds ~90 more across every muscle group
-- and equipment type so users building their own lift sessions aren't
-- stuck with the handful of movements used in AI-generated prescriptions.

INSERT INTO exercises (name, muscle_group, equipment) VALUES
  -- Chest
  ('Incline Bench Press',      'Chest',     'Barbell'),
  ('Dumbbell Bench Press',     'Chest',     'Dumbbell'),
  ('Incline Dumbbell Press',   'Chest',     'Dumbbell'),
  ('Dumbbell Fly',             'Chest',     'Dumbbell'),
  ('Cable Fly',                'Chest',     'Cable'),
  ('Push-Up',                  'Chest',     'Bodyweight'),
  ('Chest Dip',                'Chest',     'Bodyweight'),
  ('Machine Chest Press',      'Chest',     'Machine'),

  -- Back
  ('Barbell Row',              'Back',      'Barbell'),
  ('Pendlay Row',              'Back',      'Barbell'),
  ('Dumbbell Row',             'Back',      'Dumbbell'),
  ('T-Bar Row',                'Back',      'Barbell'),
  ('Lat Pulldown',             'Back',      'Cable'),
  ('Seated Cable Row',         'Back',      'Cable'),
  ('Chin-Up',                  'Back',      'Bodyweight'),
  ('Straight-Arm Pulldown',    'Back',      'Cable'),

  -- Shoulders
  ('Overhead Press',           'Shoulders', 'Barbell'),
  ('Dumbbell Shoulder Press',  'Shoulders', 'Dumbbell'),
  ('Arnold Press',             'Shoulders', 'Dumbbell'),
  ('Lateral Raise',            'Shoulders', 'Dumbbell'),
  ('Front Raise',              'Shoulders', 'Dumbbell'),
  ('Rear Delt Fly',            'Shoulders', 'Dumbbell'),
  ('Face Pull',                'Shoulders', 'Cable'),
  ('Upright Row',              'Shoulders', 'Barbell'),

  -- Arms — Biceps
  ('Barbell Curl',             'Biceps',    'Barbell'),
  ('Dumbbell Curl',            'Biceps',    'Dumbbell'),
  ('Hammer Curl',              'Biceps',    'Dumbbell'),
  ('Incline Dumbbell Curl',    'Biceps',    'Dumbbell'),
  ('Cable Curl',               'Biceps',    'Cable'),
  ('Preacher Curl',            'Biceps',    'Barbell'),

  -- Arms — Triceps
  ('Tricep Pushdown',          'Triceps',   'Cable'),
  ('Skull Crusher',            'Triceps',   'Barbell'),
  ('Overhead Tricep Extension','Triceps',   'Dumbbell'),
  ('Close-Grip Bench Press',   'Triceps',   'Barbell'),
  ('Tricep Dip',               'Triceps',   'Bodyweight'),
  ('Cable Overhead Extension', 'Triceps',   'Cable'),

  -- Legs — Quads/General
  ('Front Squat',              'Legs',      'Barbell'),
  ('Goblet Squat',             'Legs',      'Dumbbell'),
  ('Bulgarian Split Squat',    'Legs',      'Dumbbell'),
  ('Walking Lunge',            'Legs',      'Dumbbell'),
  ('Leg Press',                'Legs',      'Machine'),
  ('Leg Extension',            'Legs',      'Machine'),
  ('Hack Squat',               'Legs',      'Machine'),
  ('Step-Up',                  'Legs',      'Dumbbell'),

  -- Hamstrings / Glutes
  ('Leg Curl',                 'Hamstrings','Machine'),
  ('Good Morning',             'Hamstrings','Barbell'),
  ('Glute Bridge',             'Glutes',    'Bodyweight'),
  ('Cable Pull-Through',       'Glutes',    'Cable'),
  ('Glute Kickback',           'Glutes',    'Cable'),
  ('Sumo Deadlift',            'Glutes',    'Barbell'),

  -- Calves
  ('Seated Calf Raise',        'Calves',    'Machine'),
  ('Standing Calf Raise',      'Calves',    'Machine'),

  -- Core
  ('Hanging Leg Raise',        'Core',      'Bodyweight'),
  ('Cable Crunch',             'Core',      'Cable'),
  ('Russian Twist',            'Core',      'Bodyweight'),
  ('Ab Wheel Rollout',         'Core',      'Bodyweight'),
  ('Side Plank',               'Core',      'Bodyweight'),
  ('Hollow Body Hold',         'Core',      'Bodyweight'),
  ('Mountain Climber',         'Core',      'Bodyweight'),

  -- Full Body / Olympic / Power
  ('Power Clean',              'Full Body', 'Barbell'),
  ('Clean and Jerk',           'Full Body', 'Barbell'),
  ('Snatch',                   'Full Body', 'Barbell'),
  ('Thruster',                 'Full Body', 'Barbell'),
  ('Kettlebell Swing',         'Full Body', 'Kettlebell'),
  ('Farmer''s Carry',          'Full Body', 'Dumbbell'),
  ('Battle Ropes',             'Full Body', 'None'),
  ('Burpee',                   'Full Body', 'Bodyweight'),

  -- Power / Plyometric
  ('Broad Jump',               'Power',     'Plyometric'),
  ('Depth Jump',               'Power',     'Plyometric'),
  ('Medicine Ball Slam',       'Power',     'Medicine Ball'),

  -- Cardio staples (for the swim/bike/run structured-set work coming next)
  ('Interval Run',             'Cardio',    'None'),
  ('Hill Repeats',             'Cardio',    'None'),
  ('Easy Spin',                'Cardio',    'None'),
  ('Recovery Swim',            'Cardio',    'None'),

  -- Recovery / Mobility
  ('Dynamic Stretching',       'Recovery',  'None'),
  ('Static Stretching',        'Recovery',  'None'),
  ('Yoga Flow',                'Recovery',  'None')
ON CONFLICT (name) DO NOTHING;
