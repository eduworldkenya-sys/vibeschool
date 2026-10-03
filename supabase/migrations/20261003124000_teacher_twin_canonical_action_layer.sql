-- authorization-test: public.teacher_twin_action_receipts\n-- Canonical Teacher Twin action layer.
-- Deterministic command resolution only. Academic truth remains in exam_results.
-- Mutations require an explicit confirmed action and are re-authorized server-side.

create table if not exists public.teacher_twin_action_receipts (
  id uuid primary key,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete cascade,
  action_type text not null check (action_type in ('exam_mark')),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  target_id uuid not null,
  payload_hash text not null,
  outcome jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.teacher_twin_action_receipts enable row level security;
revoke all privileges on table public.teacher_twin_action_receipts from public, anon, authenticated;
grant select on table public.teacher_twin_action_receipts to authenticated;
grant all privileges on table public.teacher_twin_action_receipts to service_role;

drop policy if exists teacher_twin_action_receipts_read_own on public.teacher_twin_action_receipts;
create policy teacher_twin_action_receipts_read_own
on public.teacher_twin_action_receipts for select to authenticated
using (teacher_id = auth.uid());

create or replace function public.teacher_twin_resolve_exam_mark_action(
  p_learner_query text,
  p_subject_query text,
  p_exam_query text,
  p_marks numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_context jsonb;
  v_school uuid;
  v_subject record;
  v_learner record;
  v_exam record;
  v_count integer;
  v_previous numeric;
  v_previous_absent boolean;
  v_subject_q text := regexp_replace(lower(trim(coalesce(p_subject_query,''))), '[^a-z0-9]+', '', 'g');
  v_learner_q text := regexp_replace(lower(trim(coalesce(p_learner_query,''))), '[^a-z0-9]+', '', 'g');
  v_exam_q text := regexp_replace(lower(trim(coalesce(p_exam_query,''))), '[^a-z0-9]+', '', 'g');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_marks is null or p_marks < 0 or p_marks > 100 then
    return jsonb_build_object('status','invalid','message','Use a mark from 0 to 100.');
  end if;
  if v_subject_q='' or v_learner_q='' or v_exam_q='' then
    return jsonb_build_object('status','invalid','message','Learner, subject and exam are required.');
  end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_uid and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
  ) then raise exception 'teacher_account_not_active'; end if;

  v_context := public.teacher_get_operating_context(null);
  v_school := nullif(v_context->>'school_id','')::uuid;
  if v_school is null then
    return jsonb_build_object('status','not_found','message','Choose an active school before changing a mark.');
  end if;

  with candidates as (
    select distinct s.id,s.name,
      case
        when v_subject_q in ('math','maths','mathematics')
         and regexp_replace(lower(s.name),'[^a-z0-9]+','','g') in ('math','maths','mathematics') then 5
        when regexp_replace(lower(s.name),'[^a-z0-9]+','','g')=v_subject_q then 4
        when regexp_replace(lower(s.name),'[^a-z0-9]+','','g') like v_subject_q||'%' then 2
        when regexp_replace(lower(s.name),'[^a-z0-9]+','','g') like '%'||v_subject_q||'%' then 1
        else 0
      end score
    from public.teacher_classes tc
    join public.subjects s on s.id=tc.subject_id
    where tc.teacher_id=v_uid and tc.school_id=v_school
  ), best as (select max(score) score from candidates)
  select count(*)::int into v_count
  from candidates,best where candidates.score=best.score and best.score>0;

  if v_count=0 then
    return jsonb_build_object('status','not_found','message','I could not find that subject in your assigned classes.');
  elsif v_count>1 then
    return jsonb_build_object(
      'status','ambiguous','message','More than one assigned subject matches. Use the full subject name.',
      'kind','subject',
      'candidates',coalesce((
        with candidates as (
          select distinct s.id,s.name,
            case
              when v_subject_q in ('math','maths','mathematics') and regexp_replace(lower(s.name),'[^a-z0-9]+','','g') in ('math','maths','mathematics') then 5
              when regexp_replace(lower(s.name),'[^a-z0-9]+','','g')=v_subject_q then 4
              when regexp_replace(lower(s.name),'[^a-z0-9]+','','g') like v_subject_q||'%' then 2
              when regexp_replace(lower(s.name),'[^a-z0-9]+','','g') like '%'||v_subject_q||'%' then 1 else 0 end score
          from public.teacher_classes tc join public.subjects s on s.id=tc.subject_id
          where tc.teacher_id=v_uid and tc.school_id=v_school
        ), best as (select max(score) score from candidates)
        select jsonb_agg(jsonb_build_object('id',c.id,'label',c.name) order by c.name)
        from candidates c,best where c.score=best.score and best.score>0
      ),'[]'::jsonb)
    );
  end if;

  with candidates as (
    select distinct s.id,s.name,
      case
        when v_subject_q in ('math','maths','mathematics') and regexp_replace(lower(s.name),'[^a-z0-9]+','','g') in ('math','maths','mathematics') then 5
        when regexp_replace(lower(s.name),'[^a-z0-9]+','','g')=v_subject_q then 4
        when regexp_replace(lower(s.name),'[^a-z0-9]+','','g') like v_subject_q||'%' then 2
        when regexp_replace(lower(s.name),'[^a-z0-9]+','','g') like '%'||v_subject_q||'%' then 1 else 0 end score
    from public.teacher_classes tc join public.subjects s on s.id=tc.subject_id
    where tc.teacher_id=v_uid and tc.school_id=v_school
  )
  select id,name into v_subject from candidates where score>0 order by score desc,name limit 1;

  with candidates as (
    select distinct st.id,st.name,c.id class_id,c.name class_name,
      case
        when regexp_replace(lower(st.name),'[^a-z0-9]+','','g')=v_learner_q then 4
        when regexp_replace(lower(st.name),'[^a-z0-9]+','','g') like v_learner_q||'%' then 2
        when regexp_replace(lower(st.name),'[^a-z0-9]+','','g') like '%'||v_learner_q||'%' then 1
        else 0
      end score
    from public.teacher_classes tc
    join public.classes c on c.id=tc.class_id and c.school_id=tc.school_id
    join public.student_classes sc on sc.class_id=tc.class_id and sc.school_id=tc.school_id and sc.is_current=true
    join public.students st on st.id=sc.student_id and st.deleted_at is null
    where tc.teacher_id=v_uid and tc.school_id=v_school and tc.subject_id=v_subject.id
  ), best as (select max(score) score from candidates)
  select count(*)::int into v_count
  from candidates,best where candidates.score=best.score and best.score>0;

  if v_count=0 then
    return jsonb_build_object('status','not_found','message','I could not find that learner in a class where you teach this subject.');
  elsif v_count>1 then
    return jsonb_build_object(
      'status','ambiguous','kind','learner',
      'message','More than one learner matches. Add the learner full name or class.',
      'candidates',coalesce((
        with candidates as (
          select distinct st.id,st.name,c.id class_id,c.name class_name,
            case when regexp_replace(lower(st.name),'[^a-z0-9]+','','g')=v_learner_q then 4
                 when regexp_replace(lower(st.name),'[^a-z0-9]+','','g') like v_learner_q||'%' then 2
                 when regexp_replace(lower(st.name),'[^a-z0-9]+','','g') like '%'||v_learner_q||'%' then 1 else 0 end score
          from public.teacher_classes tc
          join public.classes c on c.id=tc.class_id and c.school_id=tc.school_id
          join public.student_classes sc on sc.class_id=tc.class_id and sc.school_id=tc.school_id and sc.is_current=true
          join public.students st on st.id=sc.student_id and st.deleted_at is null
          where tc.teacher_id=v_uid and tc.school_id=v_school and tc.subject_id=v_subject.id
        ), best as (select max(score) score from candidates)
        select jsonb_agg(jsonb_build_object('id',c.id,'label',c.name||' · '||c.class_name) order by c.name,c.class_name)
        from candidates c,best where c.score=best.score and best.score>0
      ),'[]'::jsonb)
    );
  end if;

  with candidates as (
    select distinct st.id,st.name,c.id class_id,c.name class_name,
      case when regexp_replace(lower(st.name),'[^a-z0-9]+','','g')=v_learner_q then 4
           when regexp_replace(lower(st.name),'[^a-z0-9]+','','g') like v_learner_q||'%' then 2
           when regexp_replace(lower(st.name),'[^a-z0-9]+','','g') like '%'||v_learner_q||'%' then 1 else 0 end score
    from public.teacher_classes tc
    join public.classes c on c.id=tc.class_id and c.school_id=tc.school_id
    join public.student_classes sc on sc.class_id=tc.class_id and sc.school_id=tc.school_id and sc.is_current=true
    join public.students st on st.id=sc.student_id and st.deleted_at is null
    where tc.teacher_id=v_uid and tc.school_id=v_school and tc.subject_id=v_subject.id
  )
  select id,name,class_id,class_name into v_learner from candidates where score>0 order by score desc,name,class_name limit 1;

  with candidates as (
    select e.id,e.name,e.exam_type,e.term,e.academic_year,
      case
        when regexp_replace(lower(e.name),'[^a-z0-9]+','','g')=v_exam_q then 5
        when regexp_replace(lower(e.exam_type),'[^a-z0-9]+','','g')=v_exam_q then 4
        when regexp_replace(lower(e.name),'[^a-z0-9]+','','g') like v_exam_q||'%' then 2
        when regexp_replace(lower(e.name),'[^a-z0-9]+','','g') like '%'||v_exam_q||'%' then 1
        else 0
      end score
    from public.exams e
    where e.school_id=v_school and not e.is_locked
  ), best as (select max(score) score from candidates)
  select count(*)::int into v_count
  from candidates,best where candidates.score=best.score and best.score>0;

  if v_count=0 then
    return jsonb_build_object('status','not_found','message','I could not find an unlocked exam matching that name.');
  elsif v_count>1 then
    return jsonb_build_object(
      'status','ambiguous','kind','exam',
      'message','More than one unlocked exam matches. Say the exam name more exactly.',
      'candidates',coalesce((
        with candidates as (
          select e.id,e.name,e.term,e.academic_year,
            case when regexp_replace(lower(e.name),'[^a-z0-9]+','','g')=v_exam_q then 5
                 when regexp_replace(lower(e.exam_type),'[^a-z0-9]+','','g')=v_exam_q then 4
                 when regexp_replace(lower(e.name),'[^a-z0-9]+','','g') like v_exam_q||'%' then 2
                 when regexp_replace(lower(e.name),'[^a-z0-9]+','','g') like '%'||v_exam_q||'%' then 1 else 0 end score
          from public.exams e where e.school_id=v_school and not e.is_locked
        ), best as (select max(score) score from candidates)
        select jsonb_agg(jsonb_build_object('id',c.id,'label',c.name||' · Term '||c.term||' · '||c.academic_year) order by c.academic_year desc,c.term desc,c.name)
        from candidates c,best where c.score=best.score and best.score>0
      ),'[]'::jsonb)
    );
  end if;

  with candidates as (
    select e.id,e.name,e.exam_type,e.term,e.academic_year,
      case when regexp_replace(lower(e.name),'[^a-z0-9]+','','g')=v_exam_q then 5
           when regexp_replace(lower(e.exam_type),'[^a-z0-9]+','','g')=v_exam_q then 4
           when regexp_replace(lower(e.name),'[^a-z0-9]+','','g') like v_exam_q||'%' then 2
           when regexp_replace(lower(e.name),'[^a-z0-9]+','','g') like '%'||v_exam_q||'%' then 1 else 0 end score
    from public.exams e where e.school_id=v_school and not e.is_locked
  )
  select id,name,exam_type,term,academic_year into v_exam from candidates where score>0 order by score desc,academic_year desc,term desc,name limit 1;

  select r.marks,r.is_absent into v_previous,v_previous_absent
  from public.exam_results r
  where r.exam_id=v_exam.id and r.student_id=v_learner.id and r.subject_id=v_subject.id
  limit 1;

  return jsonb_build_object(
    'status','ready','action_type','exam_mark','school_id',v_school,
    'class_id',v_learner.class_id,'class_name',v_learner.class_name,
    'subject_id',v_subject.id,'subject_name',v_subject.name,
    'student_id',v_learner.id,'student_name',v_learner.name,
    'exam_id',v_exam.id,'exam_name',v_exam.name,
    'term',v_exam.term,'academic_year',v_exam.academic_year,
    'marks',p_marks,'previous_marks',v_previous,'previous_absent',coalesce(v_previous_absent,false)
  );
end;
$$;

revoke all on function public.teacher_twin_resolve_exam_mark_action(text,text,text,numeric) from public, anon, service_role;
grant execute on function public.teacher_twin_resolve_exam_mark_action(text,text,text,numeric) to authenticated;

create or replace function public.teacher_twin_apply_exam_mark_action(
  p_request_id uuid,
  p_class_id uuid,
  p_subject_id uuid,
  p_student_id uuid,
  p_exam_id uuid,
  p_marks numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_context jsonb;
  v_school uuid;
  v_payload_hash text;
  v_saved public.teacher_twin_action_receipts%rowtype;
  v_student_name text;
  v_subject_name text;
  v_exam_name text;
  v_class_name text;
  v_result public.exam_results%rowtype;
  v_outcome jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null then raise exception 'request_id_required'; end if;
  if p_marks is null or p_marks<0 or p_marks>100 then raise exception 'invalid_mark'; end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_uid and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
  ) then raise exception 'teacher_account_not_active'; end if;

  v_context := public.teacher_get_operating_context(null);
  v_school := nullif(v_context->>'school_id','')::uuid;
  if v_school is null then raise exception 'active_school_required'; end if;
  if not public.teacher_can_access_class(p_class_id,p_subject_id,false) then
    raise exception 'teacher_scope_not_authorized' using errcode='42501';
  end if;
  if not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=v_school) then
    raise exception 'class_school_mismatch' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.student_classes sc
    where sc.school_id=v_school and sc.class_id=p_class_id and sc.student_id=p_student_id and sc.is_current=true
  ) then raise exception 'learner_not_currently_enrolled' using errcode='42501'; end if;
  if not exists(
    select 1 from public.teacher_classes tc
    where tc.teacher_id=v_uid and tc.school_id=v_school and tc.class_id=p_class_id and tc.subject_id=p_subject_id
  ) then raise exception 'subject_assignment_required' using errcode='42501'; end if;
  if not exists(
    select 1 from public.exams e where e.id=p_exam_id and e.school_id=v_school and not e.is_locked
  ) then raise exception 'exam_locked_or_unavailable'; end if;

  v_payload_hash := md5(jsonb_build_object(
    'teacher_id',v_uid,'school_id',v_school,'class_id',p_class_id,'subject_id',p_subject_id,
    'student_id',p_student_id,'exam_id',p_exam_id,'marks',p_marks
  )::text);
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':teacher_twin_exam_mark:'||p_request_id::text,0));

  select * into v_saved from public.teacher_twin_action_receipts where id=p_request_id;
  if v_saved.id is not null then
    if v_saved.teacher_id<>v_uid or v_saved.payload_hash<>v_payload_hash then
      raise exception 'twin_action_request_conflict';
    end if;
    return v_saved.outcome;
  end if;

  insert into public.exam_results(exam_id,school_id,class_id,subject_id,student_id,teacher_id,marks,is_absent)
  values(p_exam_id,v_school,p_class_id,p_subject_id,p_student_id,v_uid,p_marks,false)
  on conflict(exam_id,student_id,subject_id)
  do update set
    school_id=excluded.school_id,class_id=excluded.class_id,teacher_id=excluded.teacher_id,
    marks=excluded.marks,is_absent=false,updated_at=now()
  returning * into v_result;

  if v_result.id is null or v_result.marks<>p_marks or v_result.is_absent then
    raise exception 'mark_readback_failed';
  end if;

  select st.name into v_student_name from public.students st where st.id=p_student_id;
  select s.name into v_subject_name from public.subjects s where s.id=p_subject_id;
  select e.name into v_exam_name from public.exams e where e.id=p_exam_id;
  select c.name into v_class_name from public.classes c where c.id=p_class_id;

  v_outcome := jsonb_build_object(
    'status','saved','action_type','exam_mark','result_id',v_result.id,
    'student_id',p_student_id,'student_name',v_student_name,
    'class_id',p_class_id,'class_name',v_class_name,
    'subject_id',p_subject_id,'subject_name',v_subject_name,
    'exam_id',p_exam_id,'exam_name',v_exam_name,
    'marks',v_result.marks,'saved_at',v_result.updated_at
  );

  insert into public.teacher_twin_action_receipts(
    id,teacher_id,school_id,action_type,class_id,subject_id,student_id,target_id,payload_hash,outcome
  ) values(
    p_request_id,v_uid,v_school,'exam_mark',p_class_id,p_subject_id,p_student_id,p_exam_id,v_payload_hash,v_outcome
  );

  return v_outcome;
end;
$$;

revoke all on function public.teacher_twin_apply_exam_mark_action(uuid,uuid,uuid,uuid,uuid,numeric) from public, anon, service_role;
grant execute on function public.teacher_twin_apply_exam_mark_action(uuid,uuid,uuid,uuid,uuid,numeric) to authenticated;
