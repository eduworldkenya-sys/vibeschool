begin;
create table public.parent_learning_summaries(
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
 school_id uuid references public.schools(id) on delete cascade, class_id uuid references public.classes(id) on delete set null,
 period_start date not null, period_end date not null, status text not null default 'draft',
 summary jsonb not null default '{}'::jsonb, strengths text[] not null default '{}', focus_areas text[] not null default '{}',
 teacher_comment text, generated_by uuid references auth.users(id) on delete set null, approved_by uuid references auth.users(id) on delete set null,
 generated_at timestamptz not null default now(), approved_at timestamptz, published_at timestamptz,
 check(period_end>=period_start), check(status in('draft','approved','published','archived')),
 check(status not in('approved','published') or (approved_by is not null and approved_at is not null)),
 unique(student_id,period_start,period_end)
);
create table public.parent_learning_summary_sources(
 id uuid primary key default gen_random_uuid(), summary_id uuid not null references public.parent_learning_summaries(id) on delete cascade,
 source_type text not null, source_id uuid not null, created_at timestamptz not null default now(),
 check(source_type in('assignment','evidence','mark','mastery','exam_result','attendance','project','homework')), unique(summary_id,source_type,source_id)
);
create index on public.parent_learning_summaries(student_id,status,period_end desc);
alter table public.parent_learning_summaries enable row level security; alter table public.parent_learning_summary_sources enable row level security;
grant select,insert,update,delete on public.parent_learning_summaries,public.parent_learning_summary_sources to authenticated,service_role;
create policy parent_summaries_teacher_manage on public.parent_learning_summaries for all to authenticated using(generated_by=(select auth.uid()) or exists(select 1 from public.teacher_classes tc where tc.class_id=parent_learning_summaries.class_id and tc.teacher_id=(select auth.uid()))) with check(generated_by=(select auth.uid()) or exists(select 1 from public.teacher_classes tc where tc.class_id=parent_learning_summaries.class_id and tc.teacher_id=(select auth.uid())));
create policy parent_summaries_student_read on public.parent_learning_summaries for select to authenticated using(status='published' and exists(select 1 from public.students s where s.id=student_id and s.profile_id=(select auth.uid())));
create policy parent_summary_sources_teacher_manage on public.parent_learning_summary_sources for all to authenticated using(exists(select 1 from public.parent_learning_summaries s where s.id=summary_id and (s.generated_by=(select auth.uid()) or exists(select 1 from public.teacher_classes tc where tc.class_id=s.class_id and tc.teacher_id=(select auth.uid()))))) with check(exists(select 1 from public.parent_learning_summaries s where s.id=summary_id and (s.generated_by=(select auth.uid()) or exists(select 1 from public.teacher_classes tc where tc.class_id=s.class_id and tc.teacher_id=(select auth.uid())))));
create or replace function public.ce_build_parent_learning_summary(p_student_id uuid,p_period_start date,p_period_end date,p_class_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); sid uuid; school uuid; payload jsonb;
begin
 if caller is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.student_classes sc join public.teacher_classes tc on tc.class_id=sc.class_id and tc.school_id=sc.school_id where sc.student_id=p_student_id and sc.is_current and tc.teacher_id=caller and (p_class_id is null or sc.class_id=p_class_id)) then raise exception 'Not authorized for student'; end if;
 select sc.school_id into school from public.student_classes sc where sc.student_id=p_student_id and sc.is_current and (p_class_id is null or sc.class_id=p_class_id) limit 1;
 select jsonb_build_object(
  'assignment_count',(select count(*) from public.content_assignment_learners al join public.vibe_chapter_assignments a on a.id=al.assignment_id where al.student_id=p_student_id and a.assigned_at::date between p_period_start and p_period_end),
  'completed_assignments',(select count(*) from public.content_assignment_learners al join public.vibe_chapter_assignments a on a.id=al.assignment_id where al.student_id=p_student_id and al.status='completed' and a.assigned_at::date between p_period_start and p_period_end),
  'average_mark',(select avg(case when m.max_score>0 then m.score/m.max_score*100 end) from public.submission_marks m join public.content_submission_evidence e on e.id=m.evidence_id join public.content_assignment_learners al on al.id=e.assignment_learner_id where al.student_id=p_student_id and m.marked_at::date between p_period_start and p_period_end),
  'mastery',(select coalesce(jsonb_agg(jsonb_build_object('outcome_id',outcome_id,'level',mastery_level,'score',mastery_score)),'[]'::jsonb) from public.student_outcome_mastery where student_id=p_student_id)
 ) into payload;
 insert into public.parent_learning_summaries(student_id,school_id,class_id,period_start,period_end,status,summary,generated_by)
 values(p_student_id,school,p_class_id,p_period_start,p_period_end,'draft',payload,caller)
 on conflict(student_id,period_start,period_end) do update set class_id=excluded.class_id,school_id=excluded.school_id,summary=excluded.summary,generated_by=caller,generated_at=now(),status='draft'
 returning id into sid;
 return sid;
end $$;
revoke all on function public.ce_build_parent_learning_summary(uuid,date,date,uuid) from public,anon; grant execute on function public.ce_build_parent_learning_summary(uuid,date,date,uuid) to authenticated,service_role;
insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes) values('parent_visibility','public.parent_learning_summaries','Approved and published parent-facing learning summary authority',array['public.parent_learning_summary_sources','public.report_card_remarks'],'Summaries derive from assignments, evidence, marks and mastery and require approval before publication.') on conflict(domain) do update set authoritative_table=excluded.authoritative_table,authority_role=excluded.authority_role,derived_tables=excluded.derived_tables,notes=excluded.notes,updated_at=now();
commit;
