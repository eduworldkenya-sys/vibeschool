create or replace function public.student_twin_core_route(p_input text)
returns jsonb
language plpgsql
security definer
set search_path=public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_text text := btrim(coalesce(p_input,''));
  v_norm text := lower(regexp_replace(v_text,'\s+',' ','g'));
  v_brain jsonb; v_companion jsonb; v_tasks jsonb; v_revision jsonb; v_private jsonb; v_query text;
  v_intent text := 'ai_fallback'; v_payload jsonb := '{}'::jsonb; v_reply text := null;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_text='' then return jsonb_build_object('handled',true,'intent','empty','reply','Ask, search, plan or learn.','payload','{}'::jsonb,'requires_ai',false); end if;
  if v_norm ~ '^(continue|resume|carry on|where was i|continue where i stopped)[?.! ]*$' then
    v_companion:=public.student_get_learning_companion_snapshot(); v_intent:='resume';
    v_payload:=jsonb_build_object('resume_session',v_companion->'resume_session','what_matters_now',v_companion->'what_matters_now');
    v_reply:=case when v_companion->'resume_session' is not null and v_companion->'resume_session'<>'null'::jsonb then 'You have an unfinished Twin session ready to continue.' else 'There is no unfinished Twin session. I can continue with what matters most now.' end;
  elsif v_norm ~ '(homework|assignment|assignments|my tasks|what do i have to do)' then
    v_tasks:=public.student_list_my_tasks(); v_intent:='tasks'; v_payload:=jsonb_build_object('tasks',v_tasks); v_reply:='Here is your current assigned work, ordered by the task authority.';
  elsif v_norm ~ '(what should i do|what next|best next step|what matters now)' then
    v_brain:=public.student_get_twin_brain(); v_intent:='priority'; v_payload:=jsonb_build_object('now',v_brain->'decision'->'now','next',v_brain->'decision'->'next','teacher_context',v_brain->'teacher_context'); v_reply:=coalesce(v_brain#>>'{decision,now,title}','I am still building enough evidence to choose a strong next step.');
  elsif v_norm ~ '(weakest|struggling|weak skill|what am i bad at)' then
    v_brain:=public.student_get_twin_brain(); v_intent:='weakness'; v_payload:=jsonb_build_object('outcomes',coalesce(v_brain->'mastery'->'outcomes','[]'::jsonb)); v_reply:='These are your current curriculum outcomes ordered from the Twin mastery state.';
  elsif v_norm ~ '(revision|revise|what should i revise|due for revision)' then
    perform public.student_generate_adaptive_revision_plan(current_date,7); v_revision:=public.student_get_learning_companion_snapshot(); v_intent:='revision';
    v_payload:=jsonb_build_object('today_revision',coalesce(v_revision->'today_revision','[]'::jsonb),'exam_context_valid',coalesce(v_revision->'exam_context_valid','false'::jsonb));
    v_reply:=case when jsonb_array_length(coalesce(v_revision->'today_revision','[]'::jsonb))>0 then 'Here is the safe revision Twin has scheduled from your current evidence and teacher context.' else 'Nothing is due in your safe revision plan right now.' end;
  elsif v_norm ~ '(what do you remember|what twin remembers|what do you know about me|my memory)' then
    v_companion:=public.student_get_learning_companion_snapshot(); v_intent:='memory'; v_payload:=jsonb_build_object('memories',v_companion->'what_twin_remembers','confidence',v_companion->'confidence'); v_reply:='Here is the safe learning memory Twin currently keeps for you.';
  elsif v_norm ~ '^(my notes|notes|my questions|questions|my goals|goals|private space|journal)[?.! ]*$' then
    v_private:=public.student_twin_search_private_space(null,20); v_intent:='private_space'; v_payload:=v_private; v_reply:='Here is your private Twin space. These items are not mastery evidence.';
  elsif v_norm ~ '^(find|search|show me|look for) ' then
    v_query:=regexp_replace(v_text,'^(find|search|show me|look for)\s+','','i'); v_private:=public.student_twin_search_private_space(v_query,20); v_intent:='search'; v_payload:=jsonb_build_object('private',v_private,'query',v_query); v_reply:='I searched your private Twin space first. If you want, I can also search your school learning records.';
  elsif v_norm ~ '^(save|remember|note) ' then
    v_intent:='save_prompt'; v_payload:=jsonb_build_object('suggested_body',regexp_replace(v_text,'^(save|remember|note)\s+','','i')); v_reply:='I can save that privately, keep it available to Twin, or mark it for your teacher. Choose the visibility before I store it.';
  else
    return jsonb_build_object('handled',false,'intent','ai_fallback','reply',null,'payload','{}'::jsonb,'requires_ai',true);
  end if;
  return jsonb_build_object('handled',true,'intent',v_intent,'reply',v_reply,'payload',v_payload,'requires_ai',false,'authoritative_mastery',false);
end;
$$;
revoke all on function public.student_twin_core_route(text) from public, anon;
grant execute on function public.student_twin_core_route(text) to authenticated;
