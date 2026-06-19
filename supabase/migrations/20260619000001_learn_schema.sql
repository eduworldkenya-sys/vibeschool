-- supabase/migrations/20260619000001_learn_schema.sql
-- VibeSchool Learn: post-secondary / vocational learning module
-- Independent learner identity, separate from teacher/parent/student roles.

-- ─── learner_profiles ──────────────────────────────────────────────────────
create table if not exists learner_profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  display_name       text,
  avatar_initials    text default 'NJ',
  streak_days        integer default 0,
  last_active_date   date,
  preferred_language text default 'english',
  created_at         timestamptz default now()
);

-- ─── courses ───────────────────────────────────────────────────────────────
create table if not exists courses (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  title          text not null,
  institution    text,
  level          text,
  duration_label text,
  domain         text not null check (domain in ('health', 'tech', 'education', 'trade')),
  status         text not null default 'coming_soon' check (status in ('live', 'coming_soon')),
  badge          text,
  description    text,
  weeks_count    integer,
  modules_count  integer,
  created_at     timestamptz default now()
);

-- ─── modules ───────────────────────────────────────────────────────────────
create table if not exists modules (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references courses(id) on delete cascade,
  slug            text not null,
  title           text not null,
  sequence_number integer not null,
  weeks_label     text,
  created_at      timestamptz default now(),
  unique (course_id, slug)
);

-- ─── topics ────────────────────────────────────────────────────────────────
create table if not exists topics (
  id                 uuid primary key default gen_random_uuid(),
  module_id          uuid not null references modules(id) on delete cascade,
  slug               text not null,
  title              text not null,
  subtitle           text,
  sequence_number    integer not null,
  week_number        integer,
  concept_tab        jsonb,
  kenya_context_tab  jsonb,
  common_errors_tab  jsonb,
  clinical_tip_tab   jsonb,
  content_status     text not null default 'draft' check (content_status in ('draft', 'in_review', 'published')),
  created_at         timestamptz default now(),
  unique (module_id, slug)
);

-- ─── quiz_questions ────────────────────────────────────────────────────────
create table if not exists quiz_questions (
  id                 uuid primary key default gen_random_uuid(),
  topic_id           uuid not null references topics(id) on delete cascade,
  question_text      text not null,
  options            jsonb not null, -- [{ id: "opt-a", label: "A", text: "..." }, ...]
  correct_option_id  text not null,
  explanation        text,
  created_at         timestamptz default now()
);

-- ─── learner_progress ──────────────────────────────────────────────────────
-- Single source of truth for completion. Course/module progress and streaks
-- are derived from this table, never stored independently.
create table if not exists learner_progress (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid not null references learner_profiles(id) on delete cascade,
  topic_id      uuid not null references topics(id) on delete cascade,
  completed_at  timestamptz,
  quiz_score    numeric,
  created_at    timestamptz default now(),
  unique (learner_id, topic_id)
);

-- ─── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_modules_course_id on modules(course_id);
create index if not exists idx_topics_module_id on topics(module_id);
create index if not exists idx_quiz_questions_topic_id on quiz_questions(topic_id);
create index if not exists idx_learner_progress_learner_id on learner_progress(learner_id);
create index if not exists idx_learner_progress_topic_id on learner_progress(topic_id);

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table learner_profiles enable row level security;
alter table courses enable row level security;
alter table modules enable row level security;
alter table topics enable row level security;
alter table quiz_questions enable row level security;
alter table learner_progress enable row level security;

-- Public read on published catalog content
create policy "public read courses" on courses for select using (true);
create policy "public read modules" on modules for select using (true);
create policy "public read published topics" on topics for select using (content_status = 'published');
create policy "public read quiz questions" on quiz_questions for select using (true);

-- Learner profile: owner-only
create policy "learner reads own profile" on learner_profiles for select using (auth.uid() = id);
create policy "learner inserts own profile" on learner_profiles for insert with check (auth.uid() = id);
create policy "learner updates own profile" on learner_profiles for update using (auth.uid() = id);

-- Learner progress: owner-only
create policy "learner reads own progress" on learner_progress for select using (auth.uid() = learner_id);
create policy "learner inserts own progress" on learner_progress for insert with check (auth.uid() = learner_id);
create policy "learner updates own progress" on learner_progress for update using (auth.uid() = learner_id);

-- ─── Seed: pilot course (Community Health Nursing) ────────────────────────
insert into courses (slug, title, institution, level, duration_label, domain, status, badge, description, weeks_count, modules_count)
values (
  'community-health-nursing',
  'Community Health Nursing',
  'KMTC',
  'Certificate',
  '3 years',
  'health',
  'live',
  null,
  'KRCHN exam prep and clinical skills for Kenya''s community health nursing certificate.',
  32,
  5
)
on conflict (slug) do nothing;

-- Coming-soon placeholders (catalog only, no module/topic content yet)
insert into courses (slug, title, institution, level, duration_label, domain, status, badge)
values
  ('pharmacy-technician',      'Pharmacy Technician',          'KMTC',            'Certificate', '2 years', 'health',    'coming_soon', null),
  ('electrical-installation',  'Electrical Installation',      'TVET',            'Certificate', '2 years', 'trade',     'coming_soon', null),
  ('primary-teacher-education','Primary Teacher Education',    'Teachers College','Diploma',     '2 years', 'education', 'coming_soon', null),
  ('business-administration',  'Business Administration',      'University',      'Degree',      '4 years', 'trade',     'coming_soon', null),
  ('medical-laboratory-science','Medical Laboratory Science',  'KMTC',            'Diploma',     '3 years', 'health',    'coming_soon', null)
on conflict (slug) do nothing;
