-- Restrict global learner exam publication to the actual platform owner.
CREATE OR REPLACE FUNCTION public.exq_publish_public_practice(p_assessment_id uuid, p_grade text, p_max_attempts integer DEFAULT 3)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_definition public.assessment_definitions%rowtype;
  v_assignment uuid;
  v_grade text:=btrim(coalesce(p_grade,''));
  v_count integer;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false)
  then raise exception 'platform_owner_required' using errcode='42501'; end if;
  if p_max_attempts < 1 or p_max_attempts > 5 then raise exception 'invalid_max_attempts'; end if;
  select * into v_definition from public.assessment_definitions
  where id=p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if v_grade='' or not exists (
    select 1 from public.grade_subject_authority g
    join public.subjects subj on lower(btrim(subj.name))=lower(btrim(g.subject_name))
    where lower(btrim(g.grade))=lower(v_grade)
      and subj.id=v_definition.subject_id
      and (g.effective_to is null or g.effective_to>=current_date)
  ) then raise exception 'unrecognised_public_practice_grade_subject'; end if;
  if v_definition.assessment_type<>'practice'
    or v_definition.status not in ('approved','assigned','open','closed')
    or v_definition.published_at is null
  then raise exception 'public_practice_requires_published_practice'; end if;
  select count(*) into v_count from public.assessment_items
  where assessment_id=p_assessment_id and status='approved';
  if v_count=0 or exists(select 1 from public.assessment_items
    where assessment_id=p_assessment_id and status<>'approved')
  then raise exception 'public_practice_requires_approved_items'; end if;
  select id into v_assignment from public.assessment_assignments
    where assessment_id=p_assessment_id and audience='public_practice'
      and lower(btrim(audience_grade))=lower(v_grade)
      and status in ('assigned','open')
    limit 1;
  if v_assignment is not null then
    return jsonb_build_object('ok',true,'assignment_id',v_assignment,'created',false);
  end if;
  insert into public.assessment_assignments(
    assessment_id,school_id,class_id,teacher_id,audience,audience_grade,
    status,time_limit_minutes,max_attempts,show_score_policy,
    answer_review_policy,show_explanations,show_worked_solutions,assigned_at
  ) values (
    v_definition.id,null,null,v_definition.teacher_id,'public_practice',v_grade,
    'open',coalesce(v_definition.estimated_minutes,20),p_max_attempts,
    'immediate','after_release',true,true,now()
  ) returning id into v_assignment;
  return jsonb_build_object('ok',true,'assignment_id',v_assignment,'created',true);
end;
$function$
;
revoke all on function public.exq_publish_public_practice(uuid,text,integer) from public,anon;
grant execute on function public.exq_publish_public_practice(uuid,text,integer) to authenticated,service_role;
