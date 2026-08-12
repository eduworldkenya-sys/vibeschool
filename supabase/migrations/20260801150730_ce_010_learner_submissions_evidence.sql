begin;
create table public.content_assignment_learners(
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.vibe_chapter_assignments(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade, assigned_at timestamptz not null default now(), status text not null default 'assigned',
 opened_at timestamptz, submitted_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status in('assigned','opened','in_progress','submitted','completed','excused','overdue')), unique(assignment_id,student_id)
);
create table public.content_submission_evidence(
 id uuid primary key default gen_random_uuid(), assignment_learner_id uuid not null references public.content_assignment_learners(id) on delete cascade,
 evidence_type text not null, text_response text, file_url text, metadata jsonb not null default '{}'::jsonb,
 submitted_by uuid references auth.users(id) on delete set null, submitted_at timestamptz not null default now(), status text not null default 'submitted', created_at timestamptz not null default now(),
 check(evidence_type in('text','image','audio','video','document','link','reading_progress','observation')), check(status in('draft','submitted','withdrawn','accepted','rejected')),
 check(text_response is not null or file_url is not null or metadata<>'{}'::jsonb)
);
create index on public.content_assignment_learners(student_id,status); create index on public.content_submission_evidence(assignment_learner_id,status);
alter table public.content_assignment_learners enable row level security; alter table public.content_submission_evidence enable row level security;
grant select,insert,update,delete on public.content_assignment_learners,public.content_submission_evidence to authenticated,service_role;
create policy assignment_learners_teacher_read on public.content_assignment_learners for select to authenticated using(exists(select 1 from public.vibe_chapter_assignments a where a.id=assignment_id and a.teacher_id=(select auth.uid())) or exists(select 1 from public.students s where s.id=student_id and s.profile_id=(select auth.uid())));
create policy evidence_student_manage on public.content_submission_evidence for all to authenticated using(exists(select 1 from public.content_assignment_learners al join public.students s on s.id=al.student_id where al.id=assignment_learner_id and s.profile_id=(select auth.uid()))) with check(exists(select 1 from public.content_assignment_learners al join public.students s on s.id=al.student_id where al.id=assignment_learner_id and s.profile_id=(select auth.uid())));
create policy evidence_teacher_read on public.content_submission_evidence for select to authenticated using(exists(select 1 from public.content_assignment_learners al join public.vibe_chapter_assignments a on a.id=al.assignment_id where al.id=assignment_learner_id and a.teacher_id=(select auth.uid())));
insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes) values('learner_assignment_evidence','public.content_assignment_learners','Assignment-specific learner delivery and evidence authority',array['public.content_submission_evidence'],'Separates assignment membership and evidence from feature-specific homework/project tables.') on conflict(domain) do update set authoritative_table=excluded.authoritative_table,authority_role=excluded.authority_role,derived_tables=excluded.derived_tables,notes=excluded.notes,updated_at=now();
commit;
