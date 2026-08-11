begin;
create table public.competency_evidence_ledger(
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
 outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
 evidence_source text not null, evidence_id uuid, score numeric(10,2), max_score numeric(10,2), proficiency text,
 observed_by uuid references auth.users(id) on delete set null, observed_at timestamptz not null default now(), notes text,
 created_at timestamptz not null default now(),
 check(evidence_source in('lesson_observation','reading','exercise','homework','project','quiz','cat','exam','submission_mark')),
 check(score is null or score>=0), check(max_score is null or max_score>0), check(score is null or max_score is null or score<=max_score),
 check(proficiency is null or proficiency in('not_started','emerging','developing','meeting','exceeding','needs_intervention'))
);
create table public.student_outcome_mastery(
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
 outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
 mastery_level text not null default 'not_started', mastery_score numeric(5,2), evidence_count integer not null default 0,
 last_evidence_at timestamptz, updated_at timestamptz not null default now(),
 check(mastery_level in('not_started','emerging','developing','meeting','exceeding','needs_intervention')),
 check(mastery_score is null or (mastery_score>=0 and mastery_score<=100)), check(evidence_count>=0), unique(student_id,outcome_id)
);
create index on public.competency_evidence_ledger(student_id,outcome_id,observed_at desc); create index on public.student_outcome_mastery(outcome_id,mastery_level);
alter table public.competency_evidence_ledger enable row level security; alter table public.student_outcome_mastery enable row level security;
grant select,insert,update,delete on public.competency_evidence_ledger,public.student_outcome_mastery to authenticated,service_role;
create policy competency_teacher_manage on public.competency_evidence_ledger for all to authenticated using(observed_by=(select auth.uid())) with check(observed_by=(select auth.uid()));
create policy mastery_teacher_read on public.student_outcome_mastery for select to authenticated using(exists(select 1 from public.student_classes sc join public.teacher_classes tc on tc.class_id=sc.class_id and tc.school_id=sc.school_id where sc.student_id=student_id and sc.is_current and tc.teacher_id=(select auth.uid())) or exists(select 1 from public.students s where s.id=student_id and s.profile_id=(select auth.uid())));
create or replace function public.ce_refresh_student_outcome_mastery(p_student_id uuid,p_outcome_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_score numeric; v_count integer; v_last timestamptz; v_level text;
begin
 select avg(case when max_score is not null and max_score>0 then score/max_score*100 else null end),count(*),max(observed_at) into v_score,v_count,v_last
 from public.competency_evidence_ledger where student_id=p_student_id and outcome_id=p_outcome_id;
 v_level:=case when v_count=0 then 'not_started' when coalesce(v_score,0)<40 then 'needs_intervention' when v_score<55 then 'emerging' when v_score<70 then 'developing' when v_score<85 then 'meeting' else 'exceeding' end;
 insert into public.student_outcome_mastery(student_id,outcome_id,mastery_level,mastery_score,evidence_count,last_evidence_at)
 values(p_student_id,p_outcome_id,v_level,v_score,v_count,v_last)
 on conflict(student_id,outcome_id) do update set mastery_level=excluded.mastery_level,mastery_score=excluded.mastery_score,evidence_count=excluded.evidence_count,last_evidence_at=excluded.last_evidence_at,updated_at=now();
end $$;
revoke all on function public.ce_refresh_student_outcome_mastery(uuid,uuid) from public,anon,authenticated; grant execute on function public.ce_refresh_student_outcome_mastery(uuid,uuid) to service_role;
create function public.ce_refresh_mastery_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin perform public.ce_refresh_student_outcome_mastery(coalesce(new.student_id,old.student_id),coalesce(new.outcome_id,old.outcome_id)); return coalesce(new,old); end $$;
create trigger ce_refresh_mastery after insert or update or delete on public.competency_evidence_ledger for each row execute function public.ce_refresh_mastery_trigger();
insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes) values('competency_mastery','public.competency_evidence_ledger','Evidence-led learner competency authority',array['public.student_outcome_mastery'],'Mastery is derived from evidence and is never manually typed as the source of truth.') on conflict(domain) do update set authoritative_table=excluded.authoritative_table,authority_role=excluded.authority_role,derived_tables=excluded.derived_tables,notes=excluded.notes,updated_at=now();
commit;
