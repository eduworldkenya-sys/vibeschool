-- VibeSchool Task 5: final Continue Learning eligibility boundary.
-- Durable reader history may contain legacy or cross-grade books, but the action
-- surface must only promote unfinished publications explicitly tagged for the
-- learner's current class/grade. Untagged history remains history, not a recommendation.

alter function public.student_get_vibelearn_workstation()
  rename to student_get_vibelearn_workstation_scoped_base_20260819;

revoke all on function public.student_get_vibelearn_workstation_scoped_base_20260819()
  from public, anon, authenticated;
grant execute on function public.student_get_vibelearn_workstation_scoped_base_20260819()
  to service_role;

create or replace function public.student_get_vibelearn_workstation()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set timezone = 'Africa/Nairobi'
as $$
declare
  v_uid uuid := auth.uid();
  v_class_name text;
  v_class_key text;
  v_payload jsonb;
  v_continue jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select c.name
  into v_class_name
  from public.students s
  left join public.student_classes sc
    on sc.student_id=s.id and sc.is_current=true
  left join public.classes c
    on c.id=coalesce(sc.class_id,s.class_id)
  where s.profile_id=v_uid
    and s.deleted_at is null
  order by sc.joined_at desc nulls last
  limit 1;

  if v_class_name is null then raise exception 'Student class context not found'; end if;
  v_class_key := regexp_replace(lower(v_class_name), '[^a-z0-9]+', '', 'g');
  v_payload := public.student_get_vibelearn_workstation_scoped_base_20260819();

  select coalesce(jsonb_agg(x.item order by x.last_read_at desc), '[]'::jsonb)
  into v_continue
  from (
    select item,
           nullif(item->>'last_read_at','')::timestamptz as last_read_at
    from jsonb_array_elements(coalesce(v_payload->'continue_learning','[]'::jsonb)) item
    join public.vibe_publications p
      on p.id=(item->>'publication_id')::uuid
    where coalesce(nullif(item->>'progress_percent','')::numeric,0) < 100
      and nullif(btrim(p.cbc_grade),'') is not null
      and regexp_replace(lower(p.cbc_grade), '[^a-z0-9]+', '', 'g')=v_class_key
  ) x;

  return jsonb_set(v_payload,'{continue_learning}',v_continue,true);
end;
$$;

revoke all on function public.student_get_vibelearn_workstation() from public, anon;
grant execute on function public.student_get_vibelearn_workstation() to authenticated, service_role;

comment on function public.student_get_vibelearn_workstation() is
  'Task 5 final VibeLearn workstation boundary: durable history is preserved, while Continue Learning promotes only unfinished explicitly current-grade publications.';
