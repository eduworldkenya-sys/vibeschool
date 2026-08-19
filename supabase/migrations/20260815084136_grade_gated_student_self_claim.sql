-- Restored repository copy of production migration 20260815084136.
-- Production migration ledger: grade_gated_student_self_claim.

alter table public.students
  add column if not exists self_use_enabled boolean not null default false,
  add column if not exists self_use_enabled_at timestamptz,
  add column if not exists self_use_enabled_by uuid;

create or replace function public.parent_set_student_self_use(
  p_student_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_id = v_uid
      and psl.student_id = p_student_id
  ) then
    raise exception 'not_authorized';
  end if;

  update public.students
  set self_use_enabled = p_enabled,
      self_use_enabled_at = case when p_enabled then now() else null end,
      self_use_enabled_by = case when p_enabled then v_uid else null end
  where id = p_student_id;

  return jsonb_build_object(
    'status','success',
    'student_id',p_student_id,
    'self_use_enabled',p_enabled
  );
end;
$function$;
