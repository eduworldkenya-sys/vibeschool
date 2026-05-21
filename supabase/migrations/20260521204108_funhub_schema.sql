
-- ─────────────────────────────────────────
-- FUNHUB SCHEMA
-- ─────────────────────────────────────────

-- 1. GAMES REGISTRY
create table if not exists funhub_games (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null, -- 'quiz-blitz', 'trivia', 'self-exam'
  name        text not null,
  icon        text not null,
  description text,
  category    text not null check (category in ('game','exam')),
  subject     text, -- null = all subjects (trivia, self-exam)
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- 2. QUESTIONS BANK
create table if not exists funhub_questions (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null check (subject in ('maths','english','kiswahili','science','social_studies','general')),
  grade         int check (grade between 1 and 9),
  strand        text,
  sub_strand    text,
  question_text text not null,
  options       jsonb not null, -- ["A","B","C","D"]
  correct       text not null,
  explanation   text,
  difficulty    text default 'medium' check (difficulty in ('easy','medium','hard')),
  type          text default 'mcq' check (type in ('mcq','true_false','fill')),
  source        text default 'seeded' check (source in ('seeded','teacher','ai')),
  teacher_id    uuid references profiles(id) on delete set null,
  approved      boolean default true, -- teacher uploads need review later
  created_at    timestamptz default now()
);

-- 3. TRIVIA QUESTIONS (general knowledge)
create table if not exists funhub_trivia (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in ('sports','nature','world_facts','science','history','cbc')),
  question_text text not null,
  options       jsonb not null,
  correct       text not null,
  explanation   text,
  difficulty    text default 'medium' check (difficulty in ('easy','medium','hard')),
  grade_min     int default 1,
  grade_max     int default 9,
  created_at    timestamptz default now()
);

-- 4. SELF EXAMS (parent creates)
create table if not exists funhub_exams (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references profiles(id) on delete cascade,
  student_id    uuid references students(id) on delete cascade,
  title         text not null,
  subject       text not null,
  grade         int not null,
  duration_mins int not null default 30,
  question_ids  jsonb not null, -- array of question uuids
  total_marks   int not null,
  status        text default 'pending' check (status in ('pending','in_progress','completed')),
  created_at    timestamptz default now(),
  expires_at    timestamptz
);

-- 5. EXAM ATTEMPTS (child takes exam)
create table if not exists funhub_exam_attempts (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid references funhub_exams(id) on delete cascade,
  student_id    uuid references students(id) on delete cascade,
  answers       jsonb not null default '{}', -- { question_id: selected_answer }
  score         int default 0,
  total_marks   int not null,
  percentage    numeric(5,2) default 0,
  time_taken    int, -- seconds
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  status        text default 'in_progress' check (status in ('in_progress','completed'))
);

-- 6. GAME SESSIONS (every game played)
create table if not exists funhub_sessions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid references students(id) on delete cascade,
  game_slug     text not null,
  subject       text,
  grade         int,
  score         int default 0,
  xp_earned     int default 0,
  correct       int default 0,
  total         int default 0,
  duration_secs int default 0,
  streak_max    int default 0,
  completed     boolean default false,
  played_at     timestamptz default now()
);

-- 7. XP & LEVELS
create table if not exists funhub_xp (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid references students(id) on delete cascade unique,
  total_xp       int default 0,
  level          int default 1,
  weekly_xp      int default 0,
  monthly_xp     int default 0,
  week_reset_at  timestamptz default now(),
  month_reset_at timestamptz default now(),
  updated_at     timestamptz default now()
);

-- 8. STREAKS
create table if not exists funhub_streaks (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid references students(id) on delete cascade,
  subject        text not null, -- 'daily', 'maths', 'english' etc
  current_count  int default 0,
  longest_count  int default 0,
  last_played    date,
  unique(student_id, subject)
);

-- 9. LEADERBOARD (materialised weekly)
create table if not exists funhub_leaderboard (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id) on delete cascade,
  class_id    uuid references classes(id) on delete cascade,
  school_id   uuid references schools(id) on delete cascade,
  weekly_xp   int default 0,
  monthly_xp  int default 0,
  all_time_xp int default 0,
  rank_class  int,
  rank_school int,
  updated_at  timestamptz default now(),
  unique(student_id, class_id)
);

-- 10. CHALLENGES
create table if not exists funhub_challenges (
  id                uuid primary key default gen_random_uuid(),
  challenger_id     uuid references students(id) on delete cascade,
  challenged_id     uuid references students(id) on delete cascade,
  game_slug         text not null,
  challenger_score  int not null,
  challenged_score  int,
  status            text default 'pending' check (status in ('pending','accepted','completed','expired')),
  created_at        timestamptz default now(),
  expires_at        timestamptz default now() + interval '24 hours'
);

-- 11. ACHIEVEMENTS
create table if not exists funhub_achievements (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id) on delete cascade,
  badge_slug  text not null, -- 'first_game', '7_day_streak', 'top_3'
  earned_at   timestamptz default now(),
  unique(student_id, badge_slug)
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
create index on funhub_questions(subject, grade, difficulty);
create index on funhub_trivia(category, difficulty);
create index on funhub_sessions(student_id, played_at desc);
create index on funhub_leaderboard(class_id, weekly_xp desc);
create index on funhub_exams(parent_id, status);
create index on funhub_exam_attempts(exam_id, student_id);
create index on funhub_challenges(challenged_id, status);

-- ─────────────────────────────────────────
-- SEED GAMES REGISTRY
-- ─────────────────────────────────────────
insert into funhub_games (slug, name, icon, description, category, subject) values
  ('quiz-blitz',   'Quiz Blitz',    '🧠', '10 questions, 15s each, streak multiplier', 'game', null),
  ('flashcards',   'Flashcards',    '🃏', 'Flip and master key terms',                 'game', null),
  ('math-sprint',  'Math Sprint',   '🔢', '60 seconds speed arithmetic',               'game', 'maths'),
  ('word-scramble','Word Scramble', '🔤', 'Unscramble English and Kiswahili words',    'game', null),
  ('memory-match', 'Memory Match',  '🧩', 'Match terms to definitions',                'game', null),
  ('spelling-bee', 'Spelling Bee',  '🔊', 'Spell it right, beat the clock',            'game', 'english'),
  ('trivia',       'Trivia',        '🌍', 'CBC + general knowledge challenge',          'game', null),
  ('self-exam',    'Self Exam',     '📝', 'Create a custom exam for your child',        'exam', null)
on conflict (slug) do nothing;

