-- HQ product nervous system: product runtime handshakes, product event capture,
-- and owner observability. Applied to production as migration 20260809195852.

create or replace function public.hq_product_runtime_handshake(p_product_key text, p_route text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_role text; v_policy_key text; v_state jsonb; v_enabled boolean; v_school_id uuid; v_event_key text; v_event_id uuid;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select role,school_id into v_role,v_school_id from public.profiles where id=v_uid;
 v_policy_key:=case p_product_key when 'student' then 'student.enabled' when 'teacher' then 'teacher.enabled' when 'parent' then 'parent.enabled' when 'school_admin' then 'school_admin.enabled' when 'vibelearn' then 'vibelearn.enabled' when 'vibebooks' then 'vibebooks.enabled' when 'vibelabs' then 'vibelabs.enabled' when 'twin' then 'twin.enabled' when 'billing' then 'billing.enabled' else null end;
 if v_policy_key is null then raise exception 'Unknown product'; end if;
 if p_product_key in ('student','teacher','parent','school_admin') and not public.is_platform_owner() then
  if (p_product_key='student' and v_role<>'student') or (p_product_key='teacher' and v_role<>'teacher') or (p_product_key='parent' and v_role<>'parent') or (p_product_key='school_admin' and v_role<>'admin') then raise exception 'Product role mismatch'; end if;
 end if;
 v_state:=public.hq_evaluate_policy(p_product_key,v_policy_key,jsonb_build_object('surface','product_runtime_handshake','route',left(coalesce(p_route,''),240)));
 v_enabled:=coalesce((v_state->'value')::boolean,false);
 perform public.hq_record_runtime_policy_observation(p_product_key,v_policy_key,to_jsonb(v_enabled),'client_runtime_handshake');
 v_event_key:=format('runtime:%s:%s:%s:%s',v_uid,p_product_key,date_trunc('hour',now())::text,md5(coalesce(p_route,'')));
 insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,idempotency_key)
 values('product.runtime_seen',v_uid,v_role,v_school_id,'product',null,jsonb_build_object('product_key',p_product_key,'policy_key',v_policy_key,'enabled',v_enabled,'route',left(coalesce(p_route,''),240)),v_event_key)
 on conflict (idempotency_key) where idempotency_key is not null do update set occurred_at=excluded.occurred_at,metadata=excluded.metadata returning id into v_event_id;
 return jsonb_build_object('product',p_product_key,'policy',v_policy_key,'enabled',v_enabled,'event_id',v_event_id,'state',v_state);
exception when others then
 if v_policy_key is not null then perform public.hq_record_policy_failure(p_product_key,v_policy_key,sqlstate,sqlerrm,jsonb_build_object('surface','product_runtime_handshake','route',left(coalesce(p_route,''),240))); end if;
 raise;
end $$;
revoke all on function public.hq_product_runtime_handshake(text,text) from public,anon;
grant execute on function public.hq_product_runtime_handshake(text,text) to authenticated;

create or replace function public.hq_capture_product_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare n jsonb:=to_jsonb(new); o jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end; v_event_type text; v_actor_id uuid; v_actor_role text; v_school_id uuid; v_source_id text:=coalesce(n->>'id',n->>'attempt_id',n->>'session_id',n->>'submission_id'); v_status text:=coalesce(n->>'status',n->>'state',''); v_old_status text:=coalesce(o->>'status',o->>'state',''); v_actor_text text:=coalesce(n->>'student_id',n->>'teacher_id',n->>'user_id',n->>'created_by',n->>'parent_id',n->>'learner_id'); v_school_text text:=n->>'school_id'; v_key text;
begin
 if tg_op='UPDATE' and v_status=v_old_status and tg_table_name in ('assessment_attempts','vibelab_sessions') then return new; end if;
 v_event_type:=case tg_table_name when 'attendance' then case when tg_op='INSERT' then 'attendance.recorded' else 'attendance.updated' end when 'assessment_attempts' then case when tg_op='INSERT' then 'assessment.started' else 'assessment.status_changed' end when 'assessment_gradebook_entries' then 'assessment.graded' when 'lesson_evidence' then 'lesson.evidence_added' when 'lesson_reflections' then 'lesson.reflected' when 'student_twin_adaptation_events' then 'twin.adapted' when 'student_task_execution_receipts' then 'student.task_executed' when 'parent_messages' then 'communication.parent_message' when 'vibelab_sessions' then case when tg_op='INSERT' then 'vibelab.session_started' else 'vibelab.session_status_changed' end when 'vibe_reading_sessions' then 'vibelearn.reading_started' when 'exercise_submissions' then 'learning.exercise_submitted' when 'project_submissions' then 'learning.project_submitted' else 'product.data_changed' end;
 begin if v_actor_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then v_actor_id:=v_actor_text::uuid; end if; exception when others then v_actor_id:=null; end;
 begin if v_school_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then v_school_id:=v_school_text::uuid; end if; exception when others then v_school_id:=null; end;
 v_actor_role:=case when n ? 'teacher_id' then 'teacher' when n ? 'parent_id' then 'parent' when n ? 'student_id' or n ? 'learner_id' then 'student' else null end;
 v_key:=format('capture:%s:%s:%s:%s',tg_table_name,tg_op,coalesce(v_source_id,md5(n::text)),coalesce(v_status,''));
 insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,idempotency_key)
 values(v_event_type,v_actor_id,v_actor_role,v_school_id,tg_table_name,null,jsonb_strip_nulls(jsonb_build_object('source_id',v_source_id,'status',nullif(v_status,''),'operation',tg_op,'table',tg_table_name)),v_key)
 on conflict (idempotency_key) where idempotency_key is not null do nothing;
 return new;
end $$;
revoke all on function public.hq_capture_product_change() from public,anon,authenticated;

DO $$ declare t text; ops text; begin
 foreach t in array array['attendance','assessment_attempts','assessment_gradebook_entries','lesson_evidence','lesson_reflections','student_twin_adaptation_events','student_task_execution_receipts','parent_messages','vibelab_sessions','vibe_reading_sessions','exercise_submissions','project_submissions'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop trigger if exists trg_hq_product_capture on public.%I',t);
   ops:=case when t in ('assessment_attempts','vibelab_sessions','attendance') then 'insert or update' else 'insert' end;
   execute format('create trigger trg_hq_product_capture after %s on public.%I for each row execute function public.hq_capture_product_change()',ops,t);
  end if;
 end loop;
end $$;

create or replace function public.hq_get_product_nervous_system(p_hours integer default 24)
returns jsonb language plpgsql security definer set search_path=public as $$
declare h int:=greatest(1,least(coalesce(p_hours,24),168));
begin
 perform public.hq_assert_owner();
 return jsonb_build_object(
  'window_hours',h,
  'runtime_surfaces',coalesce((select jsonb_agg(x order by x->>'product_key') from (select jsonb_build_object('product_key',metadata->>'product_key','events',count(*),'actors',count(distinct actor_id),'last_seen',max(occurred_at)) x from public.platform_events where event_type='product.runtime_seen' and occurred_at>=now()-make_interval(hours=>h) group by metadata->>'product_key') q),'[]'::jsonb),
  'event_families',coalesce((select jsonb_agg(x order by (x->>'events')::int desc) from (select jsonb_build_object('family',split_part(event_type,'.',1),'events',count(*),'last_seen',max(occurred_at)) x from public.platform_events where occurred_at>=now()-make_interval(hours=>h) group by split_part(event_type,'.',1)) q),'[]'::jsonb),
  'policy_states',coalesce((select jsonb_agg(jsonb_build_object('product_key',product_key,'policy_key',policy_key,'state',state,'desired',desired_value,'observed',observed_value,'verified_at',verified_at,'last_error',last_error) order by product_key,policy_key) from public.hq_product_policy_state),'[]'::jsonb),
  'recent_policy_failures',coalesce((select jsonb_agg(jsonb_build_object('product_key',product_key,'policy_key',policy_key,'error_code',error_code,'error_message',error_message,'occurred_at',occurred_at) order by occurred_at desc) from (select * from public.hq_policy_failures where occurred_at>=now()-make_interval(hours=>h) order by occurred_at desc limit 20) f),'[]'::jsonb),
  'captured_events',(select count(*) from public.platform_events where occurred_at>=now()-make_interval(hours=>h)),
  'generated_at',now());
end $$;
revoke all on function public.hq_get_product_nervous_system(integer) from public,anon;
grant execute on function public.hq_get_product_nervous_system(integer) to authenticated;
