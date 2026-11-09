-- Regrade only legacy expired submissions with no computed result; keep other attempts immutable.
CREATE OR REPLACE FUNCTION public.exq_submit_attempt(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  caller uuid:=auth.uid();
  at public.assessment_attempts%rowtype;
  aa public.assessment_assignments%rowtype;
  learner_id uuid;
  item_rec record;
  response_rec public.assessment_responses%rowtype;
  awarded numeric;
  auto_result jsonb;
  total_awarded numeric:=0;
  total_max numeric:=0;
  manual_count integer:=0;
  final_status text;
  final_result_status text;
  pct numeric;
  tolerance numeric;
  expired boolean:=false;
  reveal_score boolean:=false;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into at from public.assessment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if at.student_id is distinct from learner_id then raise exception 'attempt_not_owned'; end if;
  -- Legacy expiry guards could strand an attempt as submitted with no marking.
  -- Permit only this exact expired, unscored state to pass through canonical marking.
  if at.status<>'in_progress'
     and not (at.status='submitted' and at.lock_reason='time_expired'
              and at.result_status='pending' and at.score is null
              and at.expires_at is not null and at.expires_at<=now())
  then raise exception 'attempt_already_submitted'; end if;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  expired:=at.expires_at is not null and at.expires_at<=now();

  for item_rec in
    select ai.* from public.assessment_items ai
    where ai.assessment_id=at.assessment_id and ai.status='approved'
    order by ai.order_num
  loop
    total_max:=total_max+item_rec.marks;
    select * into response_rec from public.assessment_responses ar
    where ar.attempt_id=at.id and ar.assessment_item_id=item_rec.id;

    if not found then
      insert into public.assessment_responses(attempt_id,assessment_item_id,response_value,status,max_score,submitted_at)
      values(at.id,item_rec.id,'null'::jsonb,'submitted',item_rec.marks,now()) returning * into response_rec;
    end if;

    awarded:=null;
    auto_result:=null;
    if item_rec.auto_marking_mode='option_match' then
      awarded:=case when response_rec.response_value=item_rec.correct_answer then item_rec.marks else 0 end;
    elsif item_rec.auto_marking_mode='exact' then
      awarded:=case when coalesce(response_rec.response_text,'')=coalesce(item_rec.correct_answer#>>'{}','') then item_rec.marks else 0 end;
    elsif item_rec.auto_marking_mode='case_insensitive' then
      awarded:=case when lower(btrim(coalesce(response_rec.response_text,'')))=lower(btrim(coalesce(item_rec.correct_answer#>>'{}',''))) then item_rec.marks else 0 end;
    elsif item_rec.auto_marking_mode='numeric_tolerance' then
      tolerance:=coalesce((item_rec.marking_guide->>'tolerance')::numeric,0);
      begin
        awarded:=case when abs((response_rec.response_text)::numeric-(item_rec.correct_answer#>>'{}')::numeric)<=tolerance then item_rec.marks else 0 end;
      exception when others then awarded:=0;
      end;
    elsif item_rec.auto_marking_mode in ('set_match','ordered_match') then
      awarded:=case when response_rec.response_value=item_rec.correct_answer then item_rec.marks else 0 end;
    else
      manual_count:=manual_count+1;
    end if;

    if awarded is not null then
      auto_result:=jsonb_build_object('mode',item_rec.auto_marking_mode,'awarded',awarded,'max',item_rec.marks);
      total_awarded:=total_awarded+awarded;
      update public.assessment_responses
      set status='auto_marked',auto_score=awarded,final_score=awarded,auto_mark_result=auto_result,submitted_at=now(),updated_at=now()
      where id=response_rec.id;
    else
      update public.assessment_responses set status='teacher_review',submitted_at=now(),updated_at=now() where id=response_rec.id;
    end if;
  end loop;

  pct:=case when total_max>0 then round((total_awarded/total_max)*100,3) else 0 end;
  final_status:=case when manual_count=0 then 'auto_marked' else 'teacher_review' end;
  final_result_status:=case when manual_count=0 then 'marked' else 'partially_marked' end;
  reveal_score:=aa.show_score_policy='immediate' and manual_count=0;

  update public.assessment_attempts
  set status=final_status,result_status=final_result_status,submitted_at=now(),auto_marked_at=case when manual_count=0 then now() else auto_marked_at end,
      score=total_awarded,max_score=total_max,percentage=pct,last_saved_at=now(),locked_at=now(),
      lock_reason=case when expired then 'time_expired' else 'submitted' end,updated_at=now()
  where id=at.id;

  return jsonb_build_object(
    'ok',true,'attempt_id',at.id,'status',final_status,'result_status',final_result_status,
    'score',case when reveal_score then total_awarded else null end,
    'max_score',case when reveal_score then total_max else null end,
    'percentage',case when reveal_score then pct else null end,
    'score_released',reveal_score,'manual_items',manual_count,'submitted_due_to_expiry',expired
  );
end;
$function$;
