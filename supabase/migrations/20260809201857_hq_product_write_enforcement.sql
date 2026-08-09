create or replace function public.hq_enforce_product_write()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_product_key text := tg_argv[0];
  v_policy_key text := tg_argv[1];
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  perform public.hq_assert_product_enabled(v_product_key, v_policy_key);
  return coalesce(new, old);
end
$function$;

revoke all on function public.hq_enforce_product_write() from public, anon, authenticated;
grant execute on function public.hq_enforce_product_write() to service_role;

drop trigger if exists trg_hq_enforce_teacher_lesson_plans on public.lesson_plans;
create trigger trg_hq_enforce_teacher_lesson_plans before insert or update or delete on public.lesson_plans for each row execute function public.hq_enforce_product_write('teacher','teacher.enabled');

drop trigger if exists trg_hq_enforce_teacher_homework on public.homework;
create trigger trg_hq_enforce_teacher_homework before insert or update or delete on public.homework for each row execute function public.hq_enforce_product_write('teacher','teacher.enabled');

drop trigger if exists trg_hq_enforce_student_homework_submissions on public.homework_submissions;
create trigger trg_hq_enforce_student_homework_submissions before insert or update or delete on public.homework_submissions for each row execute function public.hq_enforce_product_write('student','student.enabled');

drop trigger if exists trg_hq_enforce_student_project_submissions on public.project_submissions;
create trigger trg_hq_enforce_student_project_submissions before insert or update or delete on public.project_submissions for each row execute function public.hq_enforce_product_write('student','student.enabled');

drop trigger if exists trg_hq_enforce_parent_messages on public.parent_messages;
create trigger trg_hq_enforce_parent_messages before insert on public.parent_messages for each row execute function public.hq_enforce_product_write('parent','parent.enabled');

drop trigger if exists trg_hq_enforce_vibelabs_sessions on public.vibelab_sessions;
create trigger trg_hq_enforce_vibelabs_sessions before insert or update or delete on public.vibelab_sessions for each row execute function public.hq_enforce_product_write('vibelabs','vibelabs.enabled');
