create or replace function public.student_resolve_task_launch(p_task_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_student_id uuid;
  v_task jsonb;
  v_status text;
  v_task_type text;
  v_source_id uuid;
  v_action_url text;
  v_action_label text;
begin
  if v_caller is null then
    raise exception 'not_authenticated';
  end if;

  if p_task_id is null or btrim(p_task_id) = '' then
    raise exception 'task_id_required';
  end if;

  select s.id
  into v_student_id
  from public.students s
  where s.profile_id = v_caller
    and s.deleted_at is null
  limit 1;

  if v_student_id is null then
    raise exception 'learner_identity_not_found';
  end if;

  select task
  into v_task
  from jsonb_array_elements(
    coalesce(public.student_list_my_tasks()->'tasks', '[]'::jsonb)
  ) task
  where task->>'task_id' = p_task_id
  limit 1;

  if v_task is null then
    raise exception 'task_not_assigned';
  end if;

  v_status := coalesce(v_task->>'status', 'ready');
  v_task_type := coalesce(v_task->>'task_type', 'task');
  v_source_id := nullif(v_task->>'source_id', '')::uuid;

  if v_status = 'upcoming' then
    raise exception 'task_not_open';
  end if;

  if v_status = 'closed' then
    raise exception 'task_closed';
  end if;

  v_action_url := case
    when v_task_type = 'homework' then '/student/homework/' || v_source_id::text
    when v_task_type in ('quiz', 'cat', 'exam', 'remedial') then '/student/assessment/' || v_source_id::text
    when v_task_type = 'exercise' then '/student/exercises'
    when v_task_type = 'project' then '/student/projects'
    else '/student/tasks'
  end;

  v_action_label := case
    when v_status = 'released' then 'View result'
    when v_status = 'awaiting_marking' then 'Submitted'
    when v_status = 'returned' then 'Revise and resubmit'
    when v_status = 'in_progress' then 'Continue task'
    when v_status = 'overdue' then 'Complete overdue task'
    else coalesce(nullif(v_task->>'action_label', ''), 'Open task')
  end;

  return jsonb_build_object(
    'ok', true,
    'student_id', v_student_id,
    'task_id', p_task_id,
    'task_type', v_task_type,
    'source_id', v_source_id,
    'title', coalesce(v_task->>'title', 'Task'),
    'subject', coalesce(v_task->>'subject', 'General'),
    'status', v_status,
    'action_url', v_action_url,
    'action_label', v_action_label,
    'progress', coalesce((v_task->>'progress')::numeric, 0),
    'resolved_at', now()
  );
end;
$$;

revoke all on function public.student_resolve_task_launch(text) from public, anon;
grant execute on function public.student_resolve_task_launch(text) to authenticated;
