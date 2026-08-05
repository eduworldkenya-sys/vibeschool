begin;

create or replace function public.exq_complete_lesson_assessment_generation(
  p_assessment_id uuid,
  p_item_count integer,
  p_total_marks numeric,
  p_estimated_minutes integer default null,
  p_generation_metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); ad public.assessment_definitions%rowtype; actual_count integer; actual_marks numeric;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id=p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.generation_source='teacher_authored' then raise exception 'assessment_not_generated'; end if;
  if ad.status not in ('draft','review') then raise exception 'assessment_locked'; end if;
  select count(*),coalesce(sum(marks),0) into actual_count,actual_marks from public.assessment_items where assessment_id=ad.id and status<>'retired';
  if actual_count=0 then raise exception 'generated_items_required'; end if;
  if p_item_count is distinct from actual_count then raise exception 'generated_item_count_mismatch'; end if;
  if p_total_marks is distinct from actual_marks then raise exception 'generated_marks_mismatch'; end if;
  update public.assessment_definitions set generation_status='generated',generation_attempt=generation_attempt+1,
    generation_started_at=coalesce(generation_started_at,now()),generation_completed_at=now(),generation_failed_at=null,
    generation_error_code=null,generation_error_message=null,total_marks=actual_marks,estimated_minutes=p_estimated_minutes,
    generation_metadata=coalesce(generation_metadata,'{}'::jsonb)||coalesce(p_generation_metadata,'{}'::jsonb),updated_at=now()
  where id=ad.id;
  return jsonb_build_object('ok',true,'assessment_id',ad.id,'item_count',actual_count,'total_marks',actual_marks,'generation_status','generated');
end;
$$;

create or replace function public.exq_fail_lesson_assessment_generation(
  p_assessment_id uuid,p_error_code text,p_error_message text default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); ad public.assessment_definitions%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id=p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.generation_source='teacher_authored' then raise exception 'assessment_not_generated'; end if;
  update public.assessment_definitions set generation_status='failed',generation_attempt=generation_attempt+1,
    generation_started_at=coalesce(generation_started_at,now()),generation_completed_at=null,generation_failed_at=now(),
    generation_error_code=nullif(btrim(coalesce(p_error_code,'')),''),generation_error_message=nullif(btrim(coalesce(p_error_message,'')),''),updated_at=now()
  where id=ad.id;
  return jsonb_build_object('ok',true,'assessment_id',ad.id,'generation_status','failed');
end;
$$;

revoke all on function public.exq_complete_lesson_assessment_generation(uuid,integer,numeric,integer,jsonb) from public,anon;
revoke all on function public.exq_fail_lesson_assessment_generation(uuid,text,text) from public,anon;
grant execute on function public.exq_complete_lesson_assessment_generation(uuid,integer,numeric,integer,jsonb) to authenticated,service_role;
grant execute on function public.exq_fail_lesson_assessment_generation(uuid,text,text) to authenticated,service_role;

commit;
