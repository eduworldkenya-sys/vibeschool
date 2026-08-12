begin;
create table public.content_engine_daily_metrics(
 id uuid primary key default gen_random_uuid(), metric_date date not null, school_id uuid references public.schools(id) on delete cascade,
 teacher_id uuid references auth.users(id) on delete cascade, class_id uuid references public.classes(id) on delete cascade,
 subject_id uuid references public.subjects(id) on delete set null, metric_key text not null, metric_value numeric not null default 0,
 dimensions jsonb not null default '{}'::jsonb, calculated_at timestamptz not null default now(),
 check(btrim(metric_key)<>''), unique(metric_date,school_id,teacher_id,class_id,subject_id,metric_key,dimensions)
);
create index on public.content_engine_daily_metrics(teacher_id,metric_date desc); create index on public.content_engine_daily_metrics(class_id,metric_key,metric_date desc);
alter table public.content_engine_daily_metrics enable row level security;
grant select on public.content_engine_daily_metrics to authenticated; grant select,insert,update,delete on public.content_engine_daily_metrics to service_role;
create policy content_metrics_teacher_read on public.content_engine_daily_metrics for select to authenticated using(teacher_id=(select auth.uid()) or exists(select 1 from public.teacher_classes tc where tc.class_id=content_engine_daily_metrics.class_id and tc.teacher_id=(select auth.uid())));
create or replace view public.teacher_content_engine_summary with (security_invoker=true) as
select a.teacher_id,a.class_id,a.school_id,
 count(*) as assignments,
 count(*) filter(where al.status in('opened','in_progress','submitted','completed')) as learners_engaged,
 count(*) filter(where al.status='completed') as learners_completed,
 count(sm.id) filter(where sm.status='released') as released_marks,
 avg(case when sm.max_score>0 then sm.score/sm.max_score*100 end) as average_percent
from public.vibe_chapter_assignments a
left join public.content_assignment_learners al on al.assignment_id=a.id
left join public.content_submission_evidence e on e.assignment_learner_id=al.id
left join public.submission_marks sm on sm.evidence_id=e.id
group by a.teacher_id,a.class_id,a.school_id;
grant select on public.teacher_content_engine_summary to authenticated,service_role;
create or replace function public.ce_teacher_content_dashboard(p_class_id uuid default null)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
 select * from public.teacher_content_engine_summary s
 where s.teacher_id=auth.uid() and (p_class_id is null or s.class_id=p_class_id)
) x; $$;
revoke all on function public.ce_teacher_content_dashboard(uuid) from public,anon; grant execute on function public.ce_teacher_content_dashboard(uuid) to authenticated,service_role;
insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes) values('teacher_analytics','public.content_engine_daily_metrics','Derived teacher and classroom Content Engine analytics',array['public.teacher_content_engine_summary'],'Analytics derives from assignments, evidence, marking and mastery; it is not an independent transactional authority.') on conflict(domain) do update set authoritative_table=excluded.authoritative_table,authority_role=excluded.authority_role,derived_tables=excluded.derived_tables,notes=excluded.notes,updated_at=now();
commit;
