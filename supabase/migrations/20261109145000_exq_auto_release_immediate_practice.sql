-- Release fully auto-marked immediate-feedback practice, never formal exams.
create or replace function public.exq_auto_release_immediate_practice()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_assignment public.assessment_assignments%rowtype; v_def public.assessment_definitions%rowtype;
begin
 if new.status <> 'auto_marked' or new.result_status <> 'marked' then return new; end if;
 select * into v_assignment from public.assessment_assignments where id=new.assignment_id;
 select * into v_def from public.assessment_definitions where id=new.assessment_id;
 if v_def.assessment_type <> 'practice' or v_assignment.show_score_policy <> 'immediate' then return new; end if;
 if new.score is null or new.max_score is null or new.max_score<=0 then return new; end if;
 if exists(select 1 from public.assessment_moderation_requests where attempt_id=new.id and status='pending') then return new; end if;
 if exists(select 1 from public.assessment_responses where attempt_id=new.id and status<>'void' and final_score is null) then return new; end if;
 update public.assessment_attempts set status='released',result_status='released',updated_at=now() where id=new.id and status='auto_marked' and result_status='marked';
 insert into public.assessment_gradebook_entries(attempt_id,assignment_id,assessment_id,student_id,school_id,class_id,subject_id,teacher_id,score,max_score,percentage,assessment_type,assessment_title,released_at,updated_at)
 values(new.id,new.assignment_id,new.assessment_id,new.student_id,new.school_id,new.class_id,v_def.subject_id,v_assignment.teacher_id,new.score,new.max_score,new.percentage,v_def.assessment_type,v_def.title,now(),now())
 on conflict(attempt_id) do update set score=excluded.score,max_score=excluded.max_score,percentage=excluded.percentage,updated_at=now();
 insert into public.student_learning_timeline(student_id,event_type,source_type,source_id,subject_id,title,summary,occurred_at,metadata)
 select new.student_id,'assessment_released','assessment_attempt',new.id,v_def.subject_id,v_def.title,'Assessment result released',now(),jsonb_build_object('score',new.score,'max_score',new.max_score,'percentage',new.percentage)
 where not exists(select 1 from public.student_learning_timeline where source_type='assessment_attempt' and source_id=new.id and event_type='assessment_released');
 return new;
end $$;
drop trigger if exists trg_exq_auto_release_immediate_practice on public.assessment_attempts;
create trigger trg_exq_auto_release_immediate_practice after insert or update of status,result_status on public.assessment_attempts for each row execute function public.exq_auto_release_immediate_practice();
