create or replace function public.student_update_revision_item_status(p_item_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.student_revision_plan_items%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_status not in ('in_progress','completed','skipped') then raise exception 'unsupported_revision_status'; end if;

  select * into v_item
  from public.student_revision_plan_items
  where id=p_item_id and student_id=v_uid
  for update;

  if not found then raise exception 'revision_item_not_found'; end if;
  if v_item.status='completed' and p_status<>'completed' then raise exception 'completed_revision_item_is_final'; end if;

  update public.student_revision_plan_items
     set status=p_status,
         updated_at=now(),
         source=coalesce(source,'{}'::jsonb)||jsonb_build_object(
           'learner_status_updated_at',now(),
           'learner_status',p_status,
           'completion_authority','student_update_revision_item_status'
         )
   where id=p_item_id
   returning * into v_item;

  return jsonb_build_object(
    'id',v_item.id,'status',v_item.status,'plan_date',v_item.plan_date,
    'subject',v_item.subject,'topic',v_item.topic,'activity_type',v_item.activity_type,
    'target_minutes',v_item.target_minutes,'priority',v_item.priority,
    'source',v_item.source,'mastery_write_allowed',false
  );
end;
$$;

revoke all on function public.student_update_revision_item_status(uuid,text) from public;
revoke all on function public.student_update_revision_item_status(uuid,text) from anon;
grant execute on function public.student_update_revision_item_status(uuid,text) to authenticated;

-- Final P10 replay note: the live student_generate_adaptive_revision_plan_v1 authority
-- includes recent-completion suppression using learner_status_updated_at / updated_at,
-- while earlier P10 ledger versions establish context, stage/provenance and workspace safety.
