-- Fix 18E-D: mark_scheme_item_covered — guarded occurrence-based path for
-- advancing a linked scheme item from 'teaching' to 'done' after lesson
-- completion. The Scheme page's manual updateStatus(...) remains a
-- separate valid path for teachers to change scheme_of_work.status
-- directly. Guarded: teacher must own the occurrence, occurrence must be
-- 'completed', a linked lesson plan + scheme item must exist, and the
-- scheme item must currently be 'teaching'. Never touches 'planned' or
-- 'cancelled'. Idempotent on an already-'done' item (no-op success, not
-- an error) so retries/duplicate taps are always safe.

create or replace function public.mark_scheme_item_covered(
  p_occurrence_id uuid
)
returns table (
  scheme_id uuid,
  status    text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_occ       record;
  v_plan      uuid;
  v_scheme_id uuid;
  v_scheme    public.scheme_of_work;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_occurrence_id is null then
    raise exception 'occurrence_not_found';
  end if;

  select id, school_id, teacher_id, timetable_slot_id, occurrence_date, lifecycle
    into v_occ
    from public.teaching_occurrences
   where id = p_occurrence_id;

  if not found then
    raise exception 'occurrence_not_found';
  end if;

  if v_occ.teacher_id is distinct from v_uid then
    raise exception 'occurrence_not_owned';
  end if;

  if v_occ.lifecycle <> 'completed' then
    raise exception 'occurrence_not_completed';
  end if;

  select id, scheme_id
    into v_plan, v_scheme_id
    from public.lesson_plans
   where timetable_slot_id = v_occ.timetable_slot_id
     and taught_date = v_occ.occurrence_date
     and teacher_id = v_uid
     and school_id = v_occ.school_id
   order by updated_at desc nulls last, created_at desc
   limit 1;

  if v_plan is null then
    raise exception 'lesson_plan_not_found';
  end if;

  if v_scheme_id is null then
    raise exception 'scheme_item_not_found';
  end if;

  select * into v_scheme
    from public.scheme_of_work
   where id = v_scheme_id
     and school_id = v_occ.school_id
     and teacher_id = v_uid
   for update;

  if not found then
    raise exception 'scheme_item_not_found';
  end if;

  if v_scheme.status = 'done' then
    return query
    select v_scheme.id, v_scheme.status;
    return;
  end if;

  if v_scheme.status <> 'teaching' then
    raise exception 'scheme_item_not_ready';
  end if;

  update public.scheme_of_work
     set status = 'done'
   where id = v_scheme.id
  returning * into v_scheme;

  return query
  select v_scheme.id, v_scheme.status;
end;
$$;

revoke all on function public.mark_scheme_item_covered(uuid) from public;
revoke execute on function public.mark_scheme_item_covered(uuid) from anon;
grant execute on function public.mark_scheme_item_covered(uuid) to authenticated;
