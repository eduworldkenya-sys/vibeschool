begin;

create or replace function public.exq_get_builder_item(p_assessment_item_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); item_row public.assessment_items%rowtype; owner_id uuid; outcomes jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into item_row from public.assessment_items where id=p_assessment_item_id;
  if not found then raise exception 'assessment_item_not_found'; end if;
  select teacher_id into owner_id from public.assessment_definitions where id=item_row.assessment_id;
  if owner_id is distinct from caller then raise exception 'assessment_item_not_owned'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('outcome_id',aio.outcome_id,'weight',aio.weight)),'[]'::jsonb)
  into outcomes from public.assessment_item_outcomes aio where aio.assessment_item_id=item_row.id;
  return jsonb_build_object('ok',true,'item',to_jsonb(item_row),'outcomes',outcomes);
end;
$$;

create or replace function public.exq_update_draft_item(
  p_assessment_item_id uuid,p_question_type text,p_prompt text,p_marks numeric,
  p_options jsonb default '[]'::jsonb,p_accepted_answers jsonb default '[]'::jsonb,
  p_correct_answer jsonb default null,p_marking_guide jsonb default '{}'::jsonb,
  p_auto_marking_mode text default 'none',p_difficulty text default null,
  p_bloom_level text default null,p_explanation text default null,p_hint text default null,
  p_worked_solution text default null,p_teacher_notes text default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); item_row public.assessment_items%rowtype; ad public.assessment_definitions%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into item_row from public.assessment_items where id=p_assessment_item_id for update;
  if not found then raise exception 'assessment_item_not_found'; end if;
  select * into ad from public.assessment_definitions where id=item_row.assessment_id;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_item_not_owned'; end if;
  if ad.status not in ('draft','review') then raise exception 'assessment_locked'; end if;
  if btrim(coalesce(p_prompt,''))='' then raise exception 'prompt_required'; end if;
  if p_marks is null or p_marks<=0 then raise exception 'invalid_marks'; end if;
  if p_question_type in ('multiple_choice','multiple_response') and jsonb_array_length(coalesce(p_options,'[]'::jsonb))<2 then raise exception 'insufficient_options'; end if;
  if p_auto_marking_mode<>'none' and p_correct_answer is null and jsonb_array_length(coalesce(p_accepted_answers,'[]'::jsonb))=0 then raise exception 'auto_mark_answer_required'; end if;
  update public.assessment_items set question_type=p_question_type,prompt=btrim(p_prompt),marks=p_marks,
    options=coalesce(p_options,'[]'::jsonb),accepted_answers=coalesce(p_accepted_answers,'[]'::jsonb),correct_answer=p_correct_answer,
    marking_guide=coalesce(p_marking_guide,'{}'::jsonb),auto_marking_mode=p_auto_marking_mode,
    difficulty=nullif(btrim(coalesce(p_difficulty,'')),''),bloom_level=nullif(btrim(coalesce(p_bloom_level,'')),''),
    explanation=nullif(btrim(coalesce(p_explanation,'')),''),hint=nullif(btrim(coalesce(p_hint,'')),''),
    worked_solution=nullif(btrim(coalesce(p_worked_solution,'')),''),teacher_notes=nullif(btrim(coalesce(p_teacher_notes,'')),''),updated_at=now()
  where id=item_row.id;
  return jsonb_build_object('ok',true,'assessment_item_id',item_row.id);
end;
$$;

create or replace function public.exq_validate_assessment(p_assessment_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); ad public.assessment_definitions%rowtype; issues jsonb:='[]'::jsonb; item_count integer; total numeric; linked_count integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id=p_assessment_id;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  select count(*),coalesce(sum(marks),0) into item_count,total from public.assessment_items where assessment_id=ad.id and status<>'retired';
  if btrim(coalesce(ad.title,''))='' then issues:=issues||jsonb_build_array(jsonb_build_object('code','title_required','message','Assessment title is required.')); end if;
  if item_count=0 then issues:=issues||jsonb_build_array(jsonb_build_object('code','items_required','message','Add at least one question.')); end if;
  if exists(select 1 from public.assessment_items where assessment_id=ad.id and status<>'retired' group by order_num having count(*)>1) then issues:=issues||jsonb_build_array(jsonb_build_object('code','duplicate_order','message','Question order contains duplicates.')); end if;
  if exists(select 1 from public.assessment_items where assessment_id=ad.id and status<>'retired' and marks<=0) then issues:=issues||jsonb_build_array(jsonb_build_object('code','invalid_marks','message','Every question must have positive marks.')); end if;
  if exists(select 1 from public.assessment_items where assessment_id=ad.id and status<>'retired' and question_type in ('multiple_choice','multiple_response') and jsonb_array_length(options)<2) then issues:=issues||jsonb_build_array(jsonb_build_object('code','insufficient_options','message','Multiple-choice questions need at least two options.')); end if;
  if exists(select 1 from public.assessment_items where assessment_id=ad.id and status<>'retired' and auto_marking_mode<>'none' and correct_answer is null and jsonb_array_length(accepted_answers)=0) then issues:=issues||jsonb_build_array(jsonb_build_object('code','auto_mark_answer_required','message','Auto-marked questions need a correct or accepted answer.')); end if;
  select count(distinct ai.id) into linked_count from public.assessment_items ai join public.assessment_item_outcomes aio on aio.assessment_item_id=ai.id where ai.assessment_id=ad.id and ai.status<>'retired';
  if item_count>0 and linked_count<item_count then issues:=issues||jsonb_build_array(jsonb_build_object('code','outcomes_incomplete','message','Every question must link to at least one learning outcome.','unlinked_count',item_count-linked_count)); end if;
  return jsonb_build_object('ok',true,'assessment_id',ad.id,'valid',jsonb_array_length(issues)=0,'issues',issues,'item_count',item_count,'total_marks',total);
end;
$$;

create or replace function public.exq_publish_assessment(p_assessment_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); validation jsonb; ad public.assessment_definitions%rowtype; total numeric; item_count integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id=p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.status not in ('draft','review','approved') then raise exception 'invalid_assessment_state'; end if;
  validation:=public.exq_validate_assessment(p_assessment_id);
  if coalesce((validation->>'valid')::boolean,false)=false then raise exception 'assessment_validation_failed' using detail=validation::text; end if;
  select count(*),coalesce(sum(marks),0) into item_count,total from public.assessment_items where assessment_id=ad.id and status<>'retired';
  update public.assessment_items set status='approved',teacher_approved_at=coalesce(teacher_approved_at,now()),updated_at=now() where assessment_id=ad.id and status in ('draft','review');
  update public.assessment_definitions set status='approved',approved_by=caller,approved_at=coalesce(approved_at,now()),published_at=coalesce(published_at,now()),total_marks=total,updated_at=now() where id=ad.id;
  return jsonb_build_object('ok',true,'assessment_id',ad.id,'item_count',item_count,'total_marks',total,'status','approved');
end;
$$;

revoke all on function public.exq_get_builder_item(uuid) from public,anon;
revoke all on function public.exq_update_draft_item(uuid,text,text,numeric,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text) from public,anon;
revoke all on function public.exq_validate_assessment(uuid) from public,anon;
revoke all on function public.exq_publish_assessment(uuid) from public,anon;
grant execute on function public.exq_get_builder_item(uuid) to authenticated,service_role;
grant execute on function public.exq_update_draft_item(uuid,text,text,numeric,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text) to authenticated,service_role;
grant execute on function public.exq_validate_assessment(uuid) to authenticated,service_role;
grant execute on function public.exq_publish_assessment(uuid) to authenticated,service_role;

commit;
