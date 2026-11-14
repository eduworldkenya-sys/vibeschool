-- Approved VibeSchool-original recall cards are separate from canonical assessed questions.
-- Revision must never expose assessment_items.correct_answer through a pre-attempt endpoint.
create table if not exists public.vibeschool_revision_cards (
 id uuid primary key default gen_random_uuid(),
 grade text not null, subject text not null, topic text not null,
 card_key text not null, prompt text not null, answer text not null,
 explanation text not null, status text not null default 'draft'
   check(status in ('draft','approved','archived')),
 unique (grade,subject,topic,card_key)
);
alter table public.vibeschool_revision_cards enable row level security;
-- access: service-only public.vibeschool_revision_cards
-- authorization-test: public.vibeschool_revision_cards is not directly accessible to learners; only guarded grade-scoped recall RPC exposes approved cards.
revoke all on table public.vibeschool_revision_cards from public,anon,authenticated;

insert into public.vibeschool_revision_cards
 (grade,subject,topic,card_key,prompt,answer,explanation,status)
values
 ('Grade 4','Mathematics','Place Value & Total Value','g4-pv-r1',
  'In 6,318, what is the value of the digit 3?',
  '300','The digit 3 is in the hundreds place, so its value is 3 × 100 = 300.','approved'),
 ('Grade 4','Mathematics','Place Value & Total Value','g4-pv-r2',
  'What is the total value of the digit 9 in 9,406?',
  '9,000','The 9 is in the thousands place. Its total value is 9 × 1,000 = 9,000.','approved'),
 ('Grade 4','Mathematics','Place Value & Total Value','g4-pv-r3',
  'Write 5,072 in expanded form.',
  '5,000 + 70 + 2','The digits represent five thousands, zero hundreds, seven tens and two ones.','approved'),
 ('Grade 4','Mathematics','Place Value & Total Value','g4-pv-r4',
  'Which number has four thousands, two hundreds, zero tens and eight ones?',
  '4,208','Combine 4,000 + 200 + 0 + 8 to get 4,208.','approved'),
 ('Grade 4','Mathematics','Place Value & Total Value','g4-pv-r5',
  'In 8,251, which digit is in the tens place?',
  '5','Count from the right: 1 is the ones digit and 5 is the tens digit.','approved')
on conflict (grade,subject,topic,card_key) do nothing;

create or replace function public.student_revision_studio_catalog(p_grade text)
returns jsonb language plpgsql stable security definer
set search_path=public,pg_temp as $$
declare v_catalog jsonb;
begin
 if auth.uid() is null or public.current_student_id() is null then raise exception 'learner_identity_required'; end if;
 v_catalog:=public.student_list_canonical_topic_practice(p_grade);
 return coalesce((
   select jsonb_agg(t order by t->>'subject',t->>'topic')
   from jsonb_array_elements(coalesce(v_catalog,'[]'::jsonb)) t
   where exists (
     select 1 from public.vibeschool_revision_cards c
     where c.status='approved' and lower(c.grade)=lower(btrim(p_grade))
       and lower(c.subject)=lower(t->>'subject')
       and lower(c.topic)=lower(t->>'topic')
   )
 ),'[]'::jsonb);
end $$;
revoke all on function public.student_revision_studio_catalog(text) from public,anon;
grant execute on function public.student_revision_studio_catalog(text) to authenticated;

create or replace function public.student_revision_studio_cards(
 p_grade text,p_assignment_id uuid
) returns jsonb language plpgsql stable security definer
set search_path=public,pg_temp as $$
declare v_catalog jsonb; v_subject text; v_topic text; v_cards jsonb;
begin
 if auth.uid() is null or public.current_student_id() is null then raise exception 'learner_identity_required'; end if;
 if p_assignment_id is null or nullif(btrim(coalesce(p_grade,'')),'') is null then raise exception 'grade_and_topic_required'; end if;
 v_catalog:=public.student_revision_studio_catalog(p_grade);
 select t->>'subject',t->>'topic' into v_subject,v_topic
 from jsonb_array_elements(v_catalog) t where t->>'assignment_id'=p_assignment_id::text limit 1;
 if v_topic is null then raise exception 'revision_topic_not_available'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'prompt',c.prompt,'answer',c.answer,'explanation',c.explanation
 ) order by c.card_key),'[]'::jsonb)
 into v_cards from public.vibeschool_revision_cards c
 where c.status='approved' and lower(c.grade)=lower(btrim(p_grade))
   and lower(c.subject)=lower(v_subject) and lower(c.topic)=lower(v_topic);
 return jsonb_build_object('cards',v_cards,'assignment_id',p_assignment_id);
end $$;
revoke all on function public.student_revision_studio_cards(text,uuid) from public,anon;
grant execute on function public.student_revision_studio_cards(text,uuid) to authenticated;

create or replace function public.student_record_revision_topic_recall(
 p_grade text,p_assignment_id uuid,p_remembered boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_student uuid; v_catalog jsonb; v_prior public.student_revision_topic_memory%rowtype; v_days integer; v_next timestamptz;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 v_student:=public.current_student_id();
 if v_student is null then raise exception 'learner_identity_not_found'; end if;
 if p_remembered is null or p_assignment_id is null or nullif(btrim(coalesce(p_grade,'')),'') is null then raise exception 'invalid_revision_request'; end if;
 v_catalog:=public.student_revision_studio_catalog(p_grade);
 if not exists (select 1 from jsonb_array_elements(v_catalog) t
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
