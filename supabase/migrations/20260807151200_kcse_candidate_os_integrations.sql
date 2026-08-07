-- KCSE Candidate OS integration RPCs.

create or replace function public.student_classify_kcse_mistake(p_mistake_id uuid,p_error_type text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_error_type not in ('concept','formula','careless','command_word','calculation','working','time_pressure','language','unknown') then raise exception 'Invalid error type'; end if;
 if not exists(select 1 from public.student_mistake_notebook where id=p_mistake_id and student_id=v_user) then raise exception 'Mistake not found'; end if;
 insert into public.student_kcse_error_classifications(student_id,mistake_id,error_type,note,classified_at) values(v_user,p_mistake_id,p_error_type,nullif(left(coalesce(p_note,''),1000),''),now()) on conflict(student_id,mistake_id) do update set error_type=excluded.error_type,note=excluded.note,classified_at=now();
 return jsonb_build_object('ok',true,'mistake_id',p_mistake_id,'error_type',p_error_type);
end $$;

create or replace function public.student_get_kcse_recall_drill(p_subject text default null,p_asset_type text default null,p_limit integer default 12)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_limit integer:=greatest(1,least(coalesce(p_limit,12),40));
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'asset_type',asset_type,'subject',subject,'topic',topic,'prompt',prompt,'answer',answer,'media_url',media_url,'source_type',source_type,'source_ref',source_ref) order by random()) from (select * from public.kcse_revision_assets where verification_status='verified' and (p_subject is null or lower(subject)=lower(p_subject)) and (p_asset_type is null or asset_type=p_asset_type) order by random() limit v_limit)x),'[]'::jsonb));
end $$;

create or replace function public.student_search_kcse(p_query text)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); q text:=nullif(btrim(coalesce(p_query,'')),'');
begin
 if v_user is null then raise exception 'Authentication required'; end if; if q is null or length(q)<2 then return jsonb_build_object('query',coalesce(q,''),'results','[]'::jsonb); end if;
 return jsonb_build_object('query',q,'results',coalesce((select jsonb_agg(x order by rank,title) from (
   select 1 rank,'mistake' kind,m.id::text id,m.subject||' · '||m.topic title,left(m.prompt_snapshot,220) summary,'/student/vibelearn/mistakes' action_url,m.subject action_subject,m.topic action_topic from public.student_mistake_notebook m where m.student_id=v_user and (m.subject ilike '%'||q||'%' or m.topic ilike '%'||q||'%' or m.prompt_snapshot ilike '%'||q||'%')
   union all select 2,'question',e.id::text,e.subject::text||' · '||e.topic,left(e.question,220),'/student/vibelearn/kcse/practice',e.subject::text,e.topic from public.exam_question_bank e where e.status='active' and e.form::text='Form 4' and (e.subject::text ilike '%'||q||'%' or e.topic ilike '%'||q||'%' or e.question ilike '%'||q||'%')
   union all select 3,'resource',lr.id::text,lr.title,left(coalesce(lr.description,''),220),coalesce(case when lr.publication_id is not null then '/read/textbook/'||lr.publication_id::text else null end,'/student/vibelearn'),lr.subject,null from public.learning_resources lr where lr.status='published' and (lr.title ilike '%'||q||'%' or coalesce(lr.description,'') ilike '%'||q||'%' or coalesce(lr.subject,'') ilike '%'||q||'%')
   union all select 4,'syllabus',c.id::text,c.subject||' · '||c.topic,c.strand||' / '||c.sub_strand,'/student/vibelearn/kcse',c.subject,c.topic from public.curriculum c where lower(c.grade) in ('form 4','form4') and (c.subject ilike '%'||q||'%' or c.topic ilike '%'||q||'%' or c.strand ilike '%'||q||'%' or c.sub_strand ilike '%'||q||'%') limit 40
 )x),'[]'::jsonb));
end $$;

create or replace function public.student_get_kcse_progress_history()
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_student uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if; select id into v_student from public.students where profile_id=v_user and deleted_at is null limit 1; if v_student is null then raise exception 'Student profile not found'; end if;
 return jsonb_build_object('weeks',coalesce((select jsonb_agg(jsonb_build_object('week_start',week_start,'assessment_average',assessment_average,'assessment_attempts',assessment_attempts,'practice_accuracy',practice_accuracy,'practice_attempts',practice_attempts,'average_response_seconds',average_response_seconds,'mock_average',mock_average,'mock_attempts',mock_attempts) order by week_start) from (select w::date week_start,(select round(avg(a.percentage)::numeric,1) from public.assessment_attempts a where a.student_id=v_student and a.percentage is not null and a.started_at>=w and a.started_at<w+interval '7 days') assessment_average,(select count(*) from public.assessment_attempts a where a.student_id=v_student and a.percentage is not null and a.started_at>=w and a.started_at<w+interval '7 days') assessment_attempts,(select round(100.0*avg(case when p.is_correct then 1 else 0 end),1) from public.student_practice_attempts p where p.student_id=v_user and p.attempted_at>=w and p.attempted_at<w+interval '7 days') practice_accuracy,(select count(*) from public.student_practice_attempts p where p.student_id=v_user and p.attempted_at>=w and p.attempted_at<w+interval '7 days') practice_attempts,(select round(avg(p.response_ms)/1000.0,1) from public.student_practice_attempts p where p.student_id=v_user and p.response_ms is not null and p.attempted_at>=w and p.attempted_at<w+interval '7 days') average_response_seconds,(select round(avg(m.percentage)::numeric,1) from public.student_kcse_mock_sessions m where m.student_id=v_user and m.status='submitted' and m.started_at>=w and m.started_at<w+interval '7 days') mock_average,(select count(*) from public.student_kcse_mock_sessions m where m.student_id=v_user and m.status='submitted' and m.started_at>=w and m.started_at<w+interval '7 days') mock_attempts from generate_series(date_trunc('week',current_date)::date-interval '11 weeks',date_trunc('week',current_date)::date,interval '1 week')w)x),'[]'::jsonb),'interventions',coalesce((select jsonb_agg(jsonb_build_object('intervention_type',intervention_type,'intervention_key',intervention_key,'attempts',attempts,'successes',successes,'mean_mastery_delta',mean_mastery_delta,'mean_response_ms',mean_response_ms,'effectiveness_score',effectiveness_score,'confidence',confidence,'last_observed_at',last_observed_at) order by last_observed_at desc) from (select intervention_type,intervention_key,attempts,successes,mean_mastery_delta,mean_response_ms,effectiveness_score,confidence,last_observed_at from public.student_twin_intervention_effects where student_id=v_student order by last_observed_at desc limit 12)i),'[]'::jsonb));
end $$;

create or replace function public.student_get_kcse_report_card_evidence()
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_student uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if; select id into v_student from public.students where profile_id=v_user and deleted_at is null limit 1; if v_student is null then raise exception 'Student profile not found'; end if;
 return jsonb_build_object('report_cards',coalesce((select jsonb_agg(jsonb_build_object('report_card_id',r.id,'academic_year',r.academic_year,'status',r.status,'published_at',r.published_at,'subjects',coalesce((select jsonb_agg(jsonb_build_object('subject_id',rs.subject_id,'assessment_average',rs.assessment_average,'mastery_average',rs.mastery_average,'growth_percentage',rs.growth_percentage,'strongest_outcomes',rs.strongest_outcomes,'support_outcomes',rs.support_outcomes,'recommended_next_steps',rs.recommended_next_steps) order by rs.subject_id) from public.report_card_subjects rs where rs.report_card_id=r.id),'[]'::jsonb)) order by r.published_at desc) from public.report_cards r where r.student_id=v_student and r.status='published'),'[]'::jsonb));
end $$;

create or replace function public.teacher_get_student_kcse_brief(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_teacher uuid:=auth.uid(); v_profile uuid; v_target text; v_exam date;
begin
 if v_teacher is null then raise exception 'Authentication required'; end if; if not exists(select 1 from public.student_classes sc join public.teacher_classes tc on tc.class_id=sc.class_id and tc.school_id=sc.school_id where sc.student_id=p_student_id and sc.is_current and tc.teacher_id=v_teacher) then raise exception 'Not authorized'; end if; select profile_id into v_profile from public.students where id=p_student_id and deleted_at is null; select kcse_target_grade into v_target from public.student_home_state where student_id=p_student_id; if v_profile is not null then select exam_date into v_exam from public.student_exam_readiness_state where student_id=v_profile; end if;
 return jsonb_build_object('student_id',p_student_id,'profile_linked',v_profile is not null,'target_grade',v_target,'exam_date',v_exam,'subject_progress',coalesce((select jsonb_agg(jsonb_build_object('subject_id',sp.subject_id,'completed_tasks',sp.completed_tasks,'total_tasks',sp.total_tasks,'average_score',sp.average_score,'mastery_percentage',sp.mastery_percentage) order by sp.updated_at desc) from public.student_subject_progress sp where sp.student_id=p_student_id),'[]'::jsonb),'open_interventions',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'priority',i.priority,'recommendation',i.recommendation,'status',i.status,'due_at',i.due_at) order by i.created_at desc) from public.assessment_interventions i where i.student_id=p_student_id and i.status<>'completed'),'[]'::jsonb),'guardrail',case when v_profile is null then 'Student account is not linked yet; only school-owned evidence is shown.' else 'Teacher view exposes evidence and interventions, not private learner notes or public ranking.' end);
end $$;

create or replace function public.parent_get_student_kcse_brief(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_parent uuid:=auth.uid(); v_profile uuid; v_target text; v_exam date;
begin
 if v_parent is null then raise exception 'Authentication required'; end if; if not exists(select 1 from public.parent_student_links where parent_id=v_parent and student_id=p_student_id and receives_alerts) then raise exception 'Not authorized'; end if; select profile_id into v_profile from public.students where id=p_student_id and deleted_at is null; select kcse_target_grade into v_target from public.student_home_state where student_id=p_student_id; if v_profile is not null then select exam_date into v_exam from public.student_exam_readiness_state where student_id=v_profile; end if;
 return jsonb_build_object('student_id',p_student_id,'profile_linked',v_profile is not null,'target_grade',v_target,'exam_date',v_exam,'recent_results',coalesce((select jsonb_agg(jsonb_build_object('assessment_title',g.assessment_title,'assessment_type',g.assessment_type,'percentage',g.percentage,'released_at',g.released_at,'subject_id',g.subject_id) order by g.released_at desc) from (select * from public.assessment_gradebook_entries where student_id=p_student_id order by released_at desc limit 8)g),'[]'::jsonb),'consistency',case when v_profile is null then jsonb_build_object('learning_days_7d',0) else jsonb_build_object('learning_days_7d',(select count(distinct occurred_at::date) from public.student_learning_events where student_id in (v_profile,p_student_id) and occurred_at>=now()-interval '7 days')) end,'guardrail',case when v_profile is null then 'Learner account is not linked yet; only released school evidence is shown.' else 'Parent view is intentionally high-level: progress, consistency and released results only.' end);
end $$;

do $$ declare r record; begin
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'student_%kcse%' or p.proname in ('teacher_get_student_kcse_brief','parent_get_student_kcse_brief')) loop execute format('revoke all on function %s from public, anon',r.sig); execute format('grant execute on function %s to authenticated, service_role',r.sig); end loop;
end $$;
