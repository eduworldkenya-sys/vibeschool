-- Quality Worker laboratory known-good control.
-- NON-ACTIVATING: this only tightens fixture execution semantics.
create or replace function public.hq_workforce_quality_execute_lab_fixture(
  p_fixture_key text,
  p_expected text[],
  p_fixture jsonb,
  p_suite text default 'quality-adversarial-v1'
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_detected text[]; v_false text[]; v_pass boolean; v_id uuid;
begin
  if coalesce(trim(p_fixture_key),'')='' then raise exception 'quality_fixture_key_required'; end if;
  if coalesce(array_length(p_expected,1),0)=0 and p_fixture_key<>'known_good_control' then raise exception 'quality_expected_defect_required'; end if;
  if coalesce(jsonb_typeof(p_fixture),'null')<>'object' then raise exception 'quality_fixture_object_required'; end if;
  v_detected:=public.hq_workforce_quality_detect_fixture(p_fixture);
  select coalesce(array_agg(x order by x),'{}') into v_false from unnest(v_detected) x where not (x=any(coalesce(p_expected,'{}'::text[])));
  v_pass:=coalesce(p_expected,'{}'::text[]) <@ v_detected and coalesce(array_length(v_false,1),0)=0;
  if p_fixture_key='known_good_control' then v_pass:=coalesce(array_length(v_detected,1),0)=0; end if;
  insert into public.hq_workforce_quality_fixture_results(
    fixture_key,suite_version,expected_defects,detected_defects,false_positives,passed,evidence
  ) values (
    p_fixture_key,p_suite,coalesce(p_expected,'{}'::text[]),v_detected,v_false,v_pass,
    jsonb_build_object('execution_method','quality_fixture_evaluator_v1','fixture',p_fixture,'detected_by','hq_workforce_quality_detect_fixture','known_good_control',p_fixture_key='known_good_control','side_effects_applied',false,'authority_changed',false)
  ) returning id into v_id;
  return jsonb_build_object('id',v_id,'fixture_key',p_fixture_key,'passed',v_pass,'expected',coalesce(p_expected,'{}'::text[]),'detected',v_detected,'false_positives',v_false,'side_effects_applied',false,'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_quality_execute_lab_fixture(text,text[],jsonb,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_quality_execute_lab_fixture(text,text[],jsonb,text) to service_role;
