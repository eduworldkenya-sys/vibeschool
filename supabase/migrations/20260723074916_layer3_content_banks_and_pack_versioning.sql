-- Layer 2 already exists as curriculum_content. Production also carries the
-- pre-tracked workflow columns below; restore them here so a zero-to-current
-- reconstruction reaches the same authoritative shape before later Scheme
-- provenance migrations depend on them.
alter table curriculum_content add column if not exists version integer not null default 1;
alter table curriculum_content add column if not exists status text not null default 'confirmed';
alter table curriculum_content add column if not exists author_id uuid references profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.curriculum_content'::regclass
      and conname='curriculum_content_status_check'
  ) then
    alter table curriculum_content
      add constraint curriculum_content_status_check
      check (status in ('draft','pending','confirmed'));
  end if;
end $$;

-- Layer 3: reusable, queryable assessment question bank
create table assessment_questions (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references curriculum(id),
  content_pack_id uuid references curriculum_content(id),
  question_text text not null,
  question_type text not null check (question_type in ('oral','written','cat','practical')),
  options jsonb,
  correct_answer text,
  difficulty text check (difficulty in ('easy','medium','hard')),
  competency_tag text,
  source_type text not null default 'vibeschool',
  status text not null default 'draft' check (status in ('draft','pending','confirmed')),
  author_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_assessment_questions_curriculum on assessment_questions(curriculum_id);
create index idx_assessment_questions_pack on assessment_questions(content_pack_id);

alter table assessment_questions enable row level security;

create policy assessment_questions_read
  on assessment_questions
  for select
  to authenticated
  using (true);

-- Layer 3: reusable homework question bank (distinct from `homework`, which is assignment instances)
create table homework_question_bank (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references curriculum(id),
  content_pack_id uuid references curriculum_content(id),
  question_text text not null,
  question_type text not null check (question_type in ('practice','application','project','parent_activity')),
  answer text,
  difficulty text check (difficulty in ('easy','medium','hard')),
  source_type text not null default 'vibeschool',
  status text not null default 'draft' check (status in ('draft','pending','confirmed')),
  author_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_homework_bank_curriculum on homework_question_bank(curriculum_id);
create index idx_homework_bank_pack on homework_question_bank(content_pack_id);

alter table homework_question_bank enable row level security;

create policy homework_question_bank_read
  on homework_question_bank
  for select
  to authenticated
  using (true);

-- Optional traceability for Phase 5 later (which content version powered which generated artefact) —
-- column only, no wiring; generate-lesson-plan and homework flows are untouched per your sequencing.
alter table homework add column if not exists content_pack_id uuid references curriculum_content(id);
alter table homework add column if not exists content_pack_version integer;