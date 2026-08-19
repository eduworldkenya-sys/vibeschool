-- VibeSchool Task 5: assessment builder grounding reconciliation.
-- The release trigger requires assessment_items.source_block_id for approved
-- items, but the canonical exq_add_draft_item RPC did not populate that column.
-- Preserve the public signature and accept a grounded content block through the
-- existing structured source_exercise_ref payload: {"source_block_id":"<uuid>"}.

create or replace function public.exq_add_draft_item(
  p_assessment_id uuid,
  p_question_type text,
  p_prompt text,
  p_marks numeric default 1,
  p_order_num integer default null,
  p_options jsonb default '[]'::jsonb,
  p_accepted_answers jsonb default '[]'::jsonb,
  p_correct_answer jsonb default null,
  p_marking_guide jsonb default '{}'::jsonb,
  p_auto_marking_mode text default 'none',
  p_difficulty text default null,
  p_bloom_level text default null,
  p_explanation text default null,
  p_hint text default null,
  p_worked_solution text default null,
  p_source_resource_id uuid default null,
  p_source_exercise_ref jsonb default null,
  p_generated_by text default 'teacher'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  ad public.assessment_definitions%rowtype;
  resolved_order integer;
  result_id uuid;
  resolved_source_block_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id = p_assessment_id;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.status not in ('draft','review') then raise exception 'assessment_locked'; end if;
  if btrim(coalesce(p_prompt,'')) = '' then raise exception 'prompt_required'; end if;
  if p_marks is null or p_marks <= 0 then raise exception 'invalid_marks'; end if;

  resolved_order := coalesce(
    p_order_num,
    (select coalesce(max(ai.order_num),0)+1 from public.assessment_items ai where ai.assessment_id = p_assessment_id)
  );

  if p_source_exercise_ref ? 'source_block_id' then
    begin
      resolved_source_block_id := nullif(btrim(p_source_exercise_ref->>'source_block_id'),'')::uuid;
    exception when others then
      raise exception 'invalid_source_block_id';
    end;

    if resolved_source_block_id is not null and not exists (
      select 1
      from public.content_blocks cb
      where cb.id=resolved_source_block_id
        and cb.status in ('draft','published')
    ) then
      raise exception 'source_block_not_found';
    end if;
  end if;

  insert into public.assessment_items(
    assessment_id,source_resource_id,source_exercise_ref,source_block_id,question_type,prompt,
    options,accepted_answers,correct_answer,marking_guide,worked_solution,
    explanation,hint,marks,difficulty,bloom_level,auto_marking_mode,
    order_num,status,generated_by
  ) values (
    p_assessment_id,p_source_resource_id,p_source_exercise_ref,resolved_source_block_id,p_question_type,btrim(p_prompt),
    coalesce(p_options,'[]'::jsonb),coalesce(p_accepted_answers,'[]'::jsonb),p_correct_answer,
    coalesce(p_marking_guide,'{}'::jsonb),p_worked_solution,p_explanation,p_hint,
    p_marks,p_difficulty,p_bloom_level,p_auto_marking_mode,resolved_order,'draft',p_generated_by
  ) returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.exq_add_draft_item(uuid,text,text,numeric,integer,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,uuid,jsonb,text)
  from public, anon;
grant execute on function public.exq_add_draft_item(uuid,text,text,numeric,integer,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,uuid,jsonb,text)
  to authenticated, service_role;

comment on function public.exq_add_draft_item(uuid,text,text,numeric,integer,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,uuid,jsonb,text) is
  'Canonical assessment-item authoring RPC. Task 5 reconciles source_block_id grounding through source_exercise_ref without weakening the release trigger.';
