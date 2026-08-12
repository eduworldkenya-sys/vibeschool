begin;
create table public.assessment_rubrics(
 id uuid primary key default gen_random_uuid(), title text not null, description text, owner_id uuid references auth.users(id) on delete set null,
 school_id uuid references public.schools(id) on delete cascade, status text not null default 'draft', max_score numeric(10,2) not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(btrim(title)<>''), check(status in('draft','active','archived')), check(max_score>0)
);
create table public.assessment_rubric_criteria(
 id uuid primary key default gen_random_uuid(), rubric_id uuid not null references public.assessment_rubrics(id) on delete cascade,
 criterion text not null, description text, max_score numeric(10,2) not null, sequence integer not null,
 outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
 check(btrim(criterion)<>''), check(max_score>0), check(sequence>0), unique(rubric_id,sequence)
);
create table public.submission_marks(
 id uuid primary key default gen_random_uuid(), evidence_id uuid not null references public.content_submission_evidence(id) on delete cascade,
 rubric_id uuid references public.assessment_rubrics(id) on delete set null, marker_id uuid not null references auth.users(id) on delete restrict,
 score numeric(10,2) not null, max_score numeric(10,2) not null, feedback text, status text not null default 'draft', marked_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(score>=0), check(max_score>0), check(score<=max_score), check(status in('draft','released','moderated','void')), unique(evidence_id)
);
create table public.submission_criterion_marks(
 id uuid primary key default gen_random_uuid(), submission_mark_id uuid not null references public.submission_marks(id) on delete cascade,
 criterion_id uuid not null references public.assessment_rubric_criteria(id) on delete cascade, score numeric(10,2) not null, feedback text,
 check(score>=0), unique(submission_mark_id,criterion_id)
);
create index on public.submission_marks(marker_id,status); create index on public.assessment_rubric_criteria(outcome_id);
alter table public.assessment_rubrics enable row level security; alter table public.assessment_rubric_criteria enable row level security; alter table public.submission_marks enable row level security; alter table public.submission_criterion_marks enable row level security;
grant select,insert,update,delete on public.assessment_rubrics,public.assessment_rubric_criteria,public.submission_marks,public.submission_criterion_marks to authenticated,service_role;
create policy rubrics_owner_manage on public.assessment_rubrics for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy rubric_criteria_owner_manage on public.assessment_rubric_criteria for all to authenticated using(exists(select 1 from public.assessment_rubrics r where r.id=rubric_id and r.owner_id=(select auth.uid()))) with check(exists(select 1 from public.assessment_rubrics r where r.id=rubric_id and r.owner_id=(select auth.uid())));
create policy marks_teacher_manage on public.submission_marks for all to authenticated using(marker_id=(select auth.uid())) with check(marker_id=(select auth.uid()));
create policy criterion_marks_teacher_manage on public.submission_criterion_marks for all to authenticated using(exists(select 1 from public.submission_marks m where m.id=submission_mark_id and m.marker_id=(select auth.uid()))) with check(exists(select 1 from public.submission_marks m where m.id=submission_mark_id and m.marker_id=(select auth.uid())));
insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes) values('marking','public.submission_marks','Authoritative marking and feedback record for learner evidence',array['public.submission_criterion_marks'],'Supports rubric-based, moderated and releasable marking across content assignments.') on conflict(domain) do update set authoritative_table=excluded.authoritative_table,authority_role=excluded.authority_role,derived_tables=excluded.derived_tables,notes=excluded.notes,updated_at=now();
commit;
