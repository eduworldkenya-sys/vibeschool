-- Pilot Authority Chain: coherent audit lineage for claim, assessment response and exam result mutations.
create or replace function public.pilot_authority_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n jsonb := case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  o jsonb := case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_actor uuid := auth.uid();
  v_entity_id uuid;
  v_school_id uuid;
  v_student_id uuid;
  v_event_type text;
  v_source text;
begin
  begin v_entity_id := coalesce(n->>'id',o->>'id')::uuid; exception when others then v_entity_id:=null; end;
  begin v_school_id := coalesce(n->>'school_id',o->>'school_id')::uuid; exception when others then v_school_id:=null; end;
  begin v_student_id := coalesce(n->>'student_id',o->>'student_id')::uuid; exception when others then v_student_id:=null; end;
  v_source := tg_table_name;
  v_event_type := case tg_table_name
    when 'student_claim_codes' then 'authority.student_claim_changed'
    when 'assessment_responses' then 'authority.assessment_response_changed'
    when 'exam_results' then 'authority.exam_result_changed'
    else 'authority.consequential_change' end;

  insert into public.platform_events(event_type,actor_id,school_id,entity_type,entity_id,metadata,idempotency_key)
  values(v_event_type,v_actor,v_school_id,v_source,v_entity_id,
    jsonb_strip_nulls(jsonb_build_object(
      'operation',tg_op,'student_id',v_student_id,
      'attempt_id',coalesce(n->>'attempt_id',o->>'attempt_id'),
      'exam_id',coalesce(n->>'exam_id',o->>'exam_id'),
      'class_id',coalesce(n->>'class_id',o->>'class_id'),
      'subject_id',coalesce(n->>'subject_id',o->>'subject_id'),
      'teacher_id',coalesce(n->>'teacher_id',o->>'teacher_id'),
      'claimed_by',coalesce(n->>'claimed_by',o->>'claimed_by'),
      'student_claimed_by',coalesce(n->>'student_claimed_by',o->>'student_claimed_by'),
      'parent_claimed_by',coalesce(n->>'parent_claimed_by',o->>'parent_claimed_by'),
      'old_status',o->>'status','new_status',n->>'status',
      'old_marks',o->>'marks','new_marks',n->>'marks',
      'old_final_score',o->>'final_score','new_final_score',n->>'final_score'
    )),
    format('pilot-authority:%s:%s:%s:%s',tg_table_name,tg_op,coalesce(v_entity_id::text,md5(coalesce(n,o)::text)),clock_timestamp()::text));
  return case when tg_op='DELETE' then old else new end;
end $$;

revoke all on function public.pilot_authority_audit_trigger() from public, anon, authenticated;
grant execute on function public.pilot_authority_audit_trigger() to service_role;

drop trigger if exists trg_pilot_authority_claim_audit on public.student_claim_codes;
create trigger trg_pilot_authority_claim_audit after insert or update or delete on public.student_claim_codes for each row execute function public.pilot_authority_audit_trigger();
drop trigger if exists trg_pilot_authority_response_audit on public.assessment_responses;
create trigger trg_pilot_authority_response_audit after insert or update or delete on public.assessment_responses for each row execute function public.pilot_authority_audit_trigger();
drop trigger if exists trg_pilot_authority_exam_result_audit on public.exam_results;
create trigger trg_pilot_authority_exam_result_audit after insert or update or delete on public.exam_results for each row execute function public.pilot_authority_audit_trigger();
