begin;

-- Profile/version truth.
do $$
declare
  v_count integer;
  v jsonb;
begin
  select count(*) into v_count
  from public.content_worker_profiles
  where (profile_key,version) in (
    ('teacher-guide-quality-contract',3),
    ('chemistry-grade10-author',3),
    ('chemistry-content-worker-evaluation',3)
  ) and status='active';
  if v_count<>3 then
    raise exception 'CHEMISTRY_LEARNING_QUALITY_V3_PROFILES_REQUIRED';
  end if;

  v:=public.chemistry_learning_quality_contract();
  if (v->>'contract_version')::integer<>3
     or jsonb_array_length(coalesce(v->'hard_gates','[]'::jsonb))<10 then
    raise exception 'CHEMISTRY_LEARNING_QUALITY_BUNDLE_INVALID';
  end if;
end $$;

-- Prove the input binder independently of production/FK fixture data.
create temporary table chemistry_input_probe(
  input_packet jsonb not null default '{}'::jsonb
);
create trigger chemistry_input_probe_bind
before insert on chemistry_input_probe
for each row execute function public.chemistry_bind_learning_quality_contract();

insert into chemistry_input_probe default values;

do $$
declare v jsonb;
begin
  select input_packet into v from chemistry_input_probe limit 1;
  if coalesce((v#>>'{learning_quality_contract,contract_version}')::integer,0)<>3 then
    raise exception 'CHEMISTRY_LEARNING_CONTRACT_NOT_BOUND_TO_STAGE_INPUT';
  end if;
end $$;

-- Prove fail-closed PASS semantics independently of mission fixture data.
create temporary table chemistry_pass_probe(
  stage text not null,
  state text not null,
  output_packet jsonb not null default '{}'::jsonb
);
create trigger chemistry_pass_probe_enforce
before update of state,output_packet on chemistry_pass_probe
for each row execute function public.chemistry_enforce_learning_quality_pass();

insert into chemistry_pass_probe(stage,state,output_packet)
values ('AUTHORING','CLAIMED','{}'::jsonb);

do $$
begin
  begin
    update chemistry_pass_probe
    set state='SUCCEEDED',output_packet=jsonb_build_object('disposition','PASS')
    where stage='AUTHORING';
    raise exception 'NEGATIVE_CONTROL_AUTHOR_PASS_WAS_ACCEPTED';
  exception when others then
    if sqlerrm='NEGATIVE_CONTROL_AUTHOR_PASS_WAS_ACCEPTED' then raise; end if;
    if position('CHEMISTRY_LEARNING_QUALITY_CONTRACT_VERSION_REQUIRED' in sqlerrm)=0 then raise; end if;
  end;
end $$;

update chemistry_pass_probe
set state='SUCCEEDED',
    output_packet=jsonb_build_object(
      'disposition','PASS',
      'learning_quality_contract_version',3,
      'quality_evidence',jsonb_build_object(
        'outcome_coverage_complete',true,
        'concept_explanations_complete',true,
        'worked_examples_present_where_required',true,
        'learner_activities_executable',true,
        'guided_practice_present',true,
        'misconceptions_addressed',true,
        'assessment_alignment_complete',true,
        'teacher_support_complete',true,
        'scientific_accuracy_checked',true,
        'kenyan_classroom_feasibility_checked',true,
        'practical_present',true,
        'practical_safety_complete',true
      )
    )
where stage='AUTHORING';

do $$
begin
  if not exists(
    select 1 from chemistry_pass_probe
    where stage='AUTHORING' and state='SUCCEEDED'
      and output_packet->>'disposition'='PASS'
  ) then
    raise exception 'POSITIVE_CONTROL_AUTHOR_PASS_FAILED';
  end if;
end $$;

-- P2, P3 and Repair all reject unproven PASS.
insert into chemistry_pass_probe(stage,state,output_packet) values
  ('P2_REVIEW','CLAIMED','{}'::jsonb),
  ('P3_REVIEW','CLAIMED','{}'::jsonb),
  ('REPAIRING','CLAIMED','{}'::jsonb);

do $$
declare s text;
begin
  foreach s in array array['P2_REVIEW','P3_REVIEW','REPAIRING'] loop
    begin
      update chemistry_pass_probe
      set state='SUCCEEDED',
          output_packet=jsonb_build_object(
            'disposition','PASS',
            'learning_quality_contract_version',3,
            'quality_evidence','{}'::jsonb
          )
      where stage=s;
      raise exception 'NEGATIVE_CONTROL_%_PASS_WAS_ACCEPTED',s;
    exception when others then
      if sqlerrm like 'NEGATIVE_CONTROL_%' then raise; end if;
      if s='P2_REVIEW' and position('CHEMISTRY_QUALITY_PASS_MISSING_CONTRACT_EVIDENCE' in sqlerrm)=0 then raise; end if;
      if s='P3_REVIEW' and position('CHEMISTRY_CRITIC_PASS_MISSING_INDEPENDENT_EVIDENCE' in sqlerrm)=0 then raise; end if;
      if s='REPAIRING' and position('CHEMISTRY_REPAIR_PASS_MISSING_REGRESSION_EVIDENCE' in sqlerrm)=0 then raise; end if;
    end;
  end loop;
end $$;

rollback;

\echo 'Chemistry learning-quality contract operational proof: PASS'
