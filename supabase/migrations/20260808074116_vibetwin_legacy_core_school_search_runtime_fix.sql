create or replace function public.student_twin_search_school_records(p_query text default null, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path=public, pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_query text:=lower(btrim(coalesce(p_query,'')));
  v_limit integer:=greatest(1,least(coalesce(p_limit,20),50));
  v_school jsonb;
  v_tasks jsonb;
  v_sources jsonb;
  v_memory jsonb;
  v_results jsonb:='[]'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_school:=public.student_get_twin_school_context();
  v_tasks:=public.student_list_my_tasks();
  v_sources:=public.student_list_learning_transform_sources(50);
  v_memory:=public.student_get_learning_companion_snapshot();

  select coalesce(jsonb_agg(q.item order by q.item->>'rank', q.item->>'title'),'[]'::jsonb)
    into v_results
  from (
    select jsonb_build_object('kind','task','title',coalesce(t->>'title','Task'),'subtitle',coalesce(t->>'subject',''),'action_url',t->>'action_url','rank','1','raw',t) as item
    from jsonb_array_elements(coalesce(v_tasks->'tasks','[]'::jsonb)) t
    where v_query='' or lower(coalesce(t->>'title','')||' '||coalesce(t->>'subject','')) like '%'||v_query||'%'
    union all
    select jsonb_build_object('kind','scheme','title',coalesce(s->>'topic','Scheme topic'),'subtitle','Week '||coalesce(s->>'week',''),'rank','2','raw',s)
    from jsonb_array_elements(coalesce(v_school->'scheme_pacing','[]'::jsonb)) s
    where v_query='' or lower(coalesce(s->>'topic','')) like '%'||v_query||'%'
    union all
    select jsonb_build_object('kind','teacher_lesson','title',coalesce(l->>'title','Teacher lesson'),'subtitle',coalesce(l->>'taught_date',''),'rank','3','raw',l)
    from jsonb_array_elements(coalesce(v_school->'recent_teacher_lessons','[]'::jsonb)) l
    where v_query='' or lower(coalesce(l->>'title','')||' '||coalesce(l->>'topic','')) like '%'||v_query||'%'
    union all
    select jsonb_build_object('kind','learning_source','title',coalesce(src->>'title','Learning source'),'subtitle',coalesce(src->>'subtitle',''),'rank','4','raw',src)
    from jsonb_array_elements(case when jsonb_typeof(v_sources)='array' then v_sources else coalesce(v_sources->'sources','[]'::jsonb) end) src
    where v_query='' or lower(coalesce(src->>'title','')||' '||coalesce(src->>'subtitle','')) like '%'||v_query||'%'
    union all
    select jsonb_build_object('kind','memory','title',coalesce(m->>'claim','Learning memory'),'subtitle',replace(coalesce(m->>'type','memory'),'_',' '),'rank','5','raw',m)
    from jsonb_array_elements(coalesce(v_memory->'what_twin_remembers','[]'::jsonb)) m
    where v_query='' or lower(coalesce(m->>'claim','')) like '%'||v_query||'%'
  ) q;

  return jsonb_build_object('query',v_query,'items',(select coalesce(jsonb_agg(value),'[]'::jsonb) from (select value from jsonb_array_elements(v_results) value limit v_limit) z),'authoritative_mastery',false);
end;
$$;

create or replace function public.student_twin_core_route(p_input text)
returns jsonb
language plpgsql
security definer
set search_path=public, pg_temp
as $$
declare
  v_uid uuid:=auth.uid(); v_text text:=btrim(coalesce(p_input,'')); v_norm text:=lower(regexp_replace(v_text,'\s+',' ','g'));
  v_brain jsonb; v_companion jsonb; v_tasks jsonb; v_revision jsonb; v_private jsonb; v_school jsonb; v_search jsonb; v_query text; v_saved jsonb;
  v_intent text:='ai_fallback'; v_payload jsonb:='{}'::jsonb; v_reply text:=null; v_target_dow integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_text='' then return jsonb_build_object('handled',true,'intent','empty','reply','Ask, search, plan or learn.','payload','{}'::jsonb,'requires_ai',false); end if;

  if v_norm ~ '^save privately ' then
    v_saved:=public.student_twin_save_private_item('note',regexp_replace(v_text,'^save privately\s+','','i'),null,null,null,'{}','private');
    return jsonb_build_object('handled',true,'intent','saved_private','reply','Saved privately. Only your private Twin space can retrieve this unless you later choose to share it.','payload',jsonb_build_object('item',v_saved),'requires_ai',false,'authoritative_mastery',false);
  elsif v_norm ~ '^save for twin ' then
    v_saved:=public.student_twin_save_private_item('note',regexp_replace(v_text,'^save for twin\s+','','i'),null,null,null,'{}','twin');
    return jsonb_build_object('handled',true,'intent','saved_twin','reply','Saved for Twin personalization. This is still not verified mastery evidence.','payload',jsonb_build_object('item',v_saved),'requires_ai',false,'authoritative_mastery',false);
  elsif v_norm ~ '^ask teacher later ' then
    v_saved:=public.student_twin_save_private_item('ask_teacher_later',regexp_replace(v_text,'^ask teacher later\s+','','i'),null,null,null,'{}','private');
    return jsonb_build_object('handled',true,'intent','saved_teacher_later','reply','Saved privately in your “ask teacher later” list. It has not been shared with the teacher.','payload',jsonb_build_object('item',v_saved),'requires_ai',false,'authoritative_mastery',false);
  elsif v_norm ~ '^goal ' then
    v_saved:=public.student_twin_save_private_item('goal',regexp_replace(v_text,'^goal\s+','','i'),null,null,null,'{}','twin');
    return jsonb_build_object('handled',true,'intent','saved_goal','reply','Goal saved for Twin planning. A goal does not change your mastery evidence.','payload',jsonb_build_object('item',v_saved),'requires_ai',false,'authoritative_mastery',false);
  elsif v_norm ~ '(tomorrow|timetable|schedule|what class|classes today|what do i have today)' then
    v_school:=public.student_get_twin_school_context();
    v_target_dow:=case when v_norm like '%tomorrow%' then extract(isodow from (current_date+1))::integer else extract(isodow from current_date)::integer end;
    v_intent:='schedule';
    v_payload:=jsonb_build_object('day_of_week',v_target_dow,'slots',(select coalesce(jsonb_agg(s order by s->>'start_time'),'[]'::jsonb) from jsonb_array_elements(coalesce(v_school->'timetable','[]'::jsonb)) s where coalesce((s->>'day_of_week')::integer,0)=v_target_dow),'teacher_context',v_school->'scheme_pacing');
    v_reply:=case when jsonb_array_length(v_payload->'slots')>0 then case when v_norm like '%tomorrow%' then 'Here is your timetable for tomorrow.' else 'Here is your timetable for today.' end else case when v_norm like '%tomorrow%' then 'You have no timetable slots recorded for tomorrow.' else 'You have no timetable slots recorded for today.' end end;
  elsif v_norm ~ '^(continue|resume|carry on|where was i|continue where i stopped)[?.! ]*$' then
    v_companion:=public.student_get_learning_companion_snapshot(); v_intent:='resume'; v_payload:=jsonb_build_object('resume_session',v_companion->'resume_session','what_matters_now',v_companion->'what_matters_now'); v_reply:=case when v_companion->'resume_session' is not null and v_companion->'resume_session'<>'null'::jsonb then 'You have an unfinished Twin session ready to continue.' else 'There is no unfinished Twin session. I can continue with what matters most now.' end;
  elsif v_norm ~ '(homework|assignment|assignments|my tasks|what do i have to do)' then
    v_tasks:=public.student_list_my_tasks(); v_intent:='tasks'; v_payload:=jsonb_build_object('tasks',v_tasks); v_reply:='Here is your current assigned work, ordered by the task authority.';
  elsif v_norm ~ '(what should i do|what next|best next step|what matters now)' then
    v_brain:=public.student_get_twin_brain(); v_intent:='priority'; v_payload:=jsonb_build_object('now',v_brain->'decision'->'now','next',v_brain->'decision'->'next','teacher_context',v_brain->'teacher_context'); v_reply:=coalesce(v_brain#>>'{decision,now,title}','I am still building enough evidence to choose a strong next step.');
  elsif v_norm ~ '(weakest|struggling|weak skill|what am i bad at)' then
    v_brain:=public.student_get_twin_brain(); v_intent:='weakness'; v_payload:=jsonb_build_object('outcomes',coalesce(v_brain->'mastery'->'outcomes','[]'::jsonb)); v_reply:='These are your current curriculum outcomes ordered from the Twin mastery state.';
  elsif v_norm ~ '(revision|revise|what should i revise|due for revision)' then
    perform public.student_generate_adaptive_revision_plan(current_date,7); v_revision:=public.student_get_learning_companion_snapshot(); v_intent:='revision'; v_payload:=jsonb_build_object('today_revision',coalesce(v_revision->'today_revision','[]'::jsonb),'exam_context_valid',coalesce(v_revision->'exam_context_valid','false'::jsonb)); v_reply:=case when jsonb_array_length(coalesce(v_revision->'today_revision','[]'::jsonb))>0 then 'Here is the safe revision Twin has scheduled from your current evidence and teacher context.' else 'Nothing is due in your safe revision plan right now.' end;
  elsif v_norm ~ '(what do you remember|what twin remembers|what do you know about me|my memory)' then
    v_companion:=public.student_get_learning_companion_snapshot(); v_intent:='memory'; v_payload:=jsonb_build_object('memories',v_companion->'what_twin_remembers','confidence',v_companion->'confidence'); v_reply:='Here is the safe learning memory Twin currently keeps for you.';
  elsif v_norm ~ '^(my notes|notes|my questions|questions|my goals|goals|private space|journal)[?.! ]*$' then
    v_private:=public.student_twin_search_private_space(null,20); v_intent:='private_space'; v_payload:=v_private; v_reply:='Here is your private Twin space. These items are not mastery evidence.';
  elsif v_norm ~ '^(find|search|show me|look for) ' then
    v_query:=regexp_replace(v_text,'^(find|search|show me|look for)\s+','','i'); v_private:=public.student_twin_search_private_space(v_query,20); v_search:=public.student_twin_search_school_records(v_query,20); v_intent:='search'; v_payload:=jsonb_build_object('private',v_private,'school',v_search,'query',v_query); v_reply:='I searched both your private Twin space and your authorized school learning records.';
  elsif v_norm ~ '^(save|remember|note) ' then
    v_intent:='save_prompt'; v_payload:=jsonb_build_object('suggested_body',regexp_replace(v_text,'^(save|remember|note)\s+','','i')); v_reply:='I can save that privately, keep it available to Twin, or mark it for your teacher. Choose the visibility before I store it.';
  else return jsonb_build_object('handled',false,'intent','ai_fallback','reply',null,'payload','{}'::jsonb,'requires_ai',true);
  end if;
  return jsonb_build_object('handled',true,'intent',v_intent,'reply',v_reply,'payload',v_payload,'requires_ai',false,'authoritative_mastery',false);
end;
$$;

revoke all on function public.student_twin_search_school_records(text,integer) from public, anon;
revoke all on function public.student_twin_core_route(text) from public, anon;
grant execute on function public.student_twin_search_school_records(text,integer) to authenticated;
grant execute on function public.student_twin_core_route(text) to authenticated;
