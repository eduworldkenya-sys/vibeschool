-- Revision Studio must work before a learner has mistakes.
-- Only public, approved, canonical topic-practice material is reused as recall cards.
create table if not exists public.student_revision_topic_memory (
  student_id uuid not null references public.students(id) on delete cascade,
  assignment_id uuid not null references public.assessment_assignments(id) on delete cascade,
  recall_count integer not null default 0 check (recall_count >= 0),
  interval_days integer not null default 1 check (interval_days between 1 and 60),
  last_remembered boolean,
  last_recalled_at timestamptz,
  next_review_at timestamptz not null default now(),
  primary key (student_id,assignment_id)
);
create index if not exists student_revision_topic_memory_due_idx on public.student_revision_topic_memory(student_id,next_review_at);
alter table public.student_revision_topic_memory enable row level security;
-- authorization-test: public.student_revision_topic_memory learner-only read, guarded RPC-only writes, no anonymous access.
revoke all on table public.student_revision_topic_memory from public,anon,authenticated;
grant select on table public.student_revision_topic_memory to authenticated;
drop policy if exists student_revision_topic_memory_read_own on public.student_revision_topic_memory;
create policy student_revision_topic_memory_read_own on public.student_revision_topic_memory
 for select to authenticated using (student_id = public.current_student_id());

create or replace function public.student_revision_studio_cards(
  p_grade text,p_assignment_id uuid
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_student uuid; v_catalog jsonb; v_assessment uuid; v_cards jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 v_student:=public.current_student_id();
 if v_student is null then raise exception 'learner_identity_not_found'; end if;
 if p_assignment_id is null or nullif(btrim(p_grade),'') is null then raise exception 'grade_and_topic_required'; end if;
 v_catalog:=public.student_list_canonical_topic_practice(p_grade);
 if not exists (select 1 from jsonb_array_elements(coalesce(v_catalog,'[]'::jsonb)) t
   where t->>'assignment_id'=p_assignment_id::text) then raise exception 'revision_topic_not_available'; end if;
 select aa.assessment_id into v_assessment from public.assessment_assignments aa where aa.id=p_assignment_id;
 select coalesce(jsonb_agg(jsonb_build_object(
    'id',ai.id,'prompt',ai.prompt,
    'answer',coalesce((select opt->>'label' from jsonb_array_elements(ai.options) opt
       where opt->>'value'=ai.correct_answer#>>'{}' limit 1),ai.correct_answer#>>'{}'),
    'explanation',coalesce(nullif(ai.explanation,''),nullif(ai.worked_solution,''),nullif(ai.marking_guide,''),'Review the correct answer before continuing')
  ) order by ai.order_num,ai.id),'[]'::jsonb) into v_cards
 from public.assessment_items ai
 where ai.assessment_id=v_assessment and ai.status='approved'
   and ai.question_type='multiple_choice' and ai.auto_marking_mode='option_match';
 return jsonb_build_object('cards',v_cards,'assignment_id',p_assignment_id);
end $$;
revoke all on function public.student_revision_studio_cards(text,uuid) from public,anon;
grant execute on function public.student_revision_studio_cards(text,uuid) to authenticated;

create or replace function public.student_record_revision_topic_recall(
 p_grade text,p_assignment_id uuid,p_remembered boolean
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_student uuid; v_catalog jsonb; v_prior public.student_revision_topic_memory%rowtype; v_days integer; v_next timestamptz;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 v_student:=public.current_student_id();
 if v_student is null then raise exception 'learner_identity_not_found'; end if;
 if p_remembered is null or p_assignment_id is null or nullif(btrim(p_grade),'') is null then raise exception 'invalid_revision_request'; end if;
 v_catalog:=public.student_list_canonical_topic_practice(p_grade);
 if not exists (select 1 from jsonb_array_elements(coalesce(v_catalog,'[]'::jsonb)) t
   where t->>'assignment_id'=p_assignment_id::text) then raise exception 'revision_topic_not_available'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_student::text||':'||p_assignment_id::text,0));
 select * into v_prior from public.student_revision_topic_memory
  where student_id=v_student and assignment_id=p_assignment_id;
 v_days:=case when not p_remembered then 1
   when v_prior.recall_count is null or v_prior.recall_count=0 then 3
   else least(60,greatest(3,v_prior.interval_days*2)) end;
 v_next:=now()+make_interval(days=>v_days);
 insert into public.student_revision_topic_memory
   (student_id,assignment_id,recall_count,interval_days,last_remembered,last_recalled_at,next_review_at)
 values(v_student,p_assignment_id,1,v_days,p_remembered,now(),v_next)
 on conflict(student_id,assignment_id) do update set
   recall_count=public.student_revision_topic_memory.recall_count+1,
   interval_days=excluded.interval_days,last_remembered=excluded.last_remembered,
   last_recalled_at=excluded.last_recalled_at,next_review_at=excluded.next_review_at;
 return jsonb_build_object('recorded',true,'next_review_at',v_next,'interval_days',v_days);
end $$;
revoke all on function public.student_record_revision_topic_recall(text,uuid,boolean) from public,anon;
grant execute on function public.student_record_revision_topic_recall(text,uuid,boolean) to authenticated;
