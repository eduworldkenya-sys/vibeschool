-- Run after the HQ coverage migration in a disposable database or approved
-- read-only verification session. No data is written. Do not run as an end user.
begin;
do $test$
declare
  v jsonb;
  v_subject jsonb;
  v_grade4 jsonb;
  v_topics jsonb;
begin
  if has_function_privilege('anon', 'public.hq_content_coverage(text,text)', 'execute') then
    raise exception 'HQ coverage callable by anon';
  end if;
  v := public.hq_content_coverage();
  if jsonb_typeof(v->'subjects') <> 'array'
     or jsonb_typeof(v->'outcomes') <> 'array'
     or jsonb_typeof(v->'topics') <> 'array'
     or jsonb_typeof(v->'diagnostics') <> 'object' then
    raise exception 'HQ coverage JSON contract invalid';
  end if;
  if jsonb_array_length(v->'outcomes') <> 0
     or jsonb_array_length(v->'topics') <> 0 then
    raise exception 'Unfiltered coverage leaked detailed content';
  end if;
  for v_subject in select value from jsonb_array_elements(v->'subjects') loop
    if (v_subject->>'outcomes')::integer < (v_subject->>'verified_outcomes')::integer
       or (v_subject->>'outcomes')::integer < (v_subject->>'authored_outcomes')::integer
       or (v_subject->>'outcomes')::integer < (v_subject->>'certified_outcomes')::integer
       or (v_subject->>'outcomes')::integer < (v_subject->>'core_release_claims')::integer then
      raise exception 'Subject counter exceeds outcome denominator: %', v_subject;
    end if;
  end loop;
  v_grade4 := public.hq_content_coverage('Grade 4', 'Mathematics');
  v_topics := v_grade4->'topics';
  if jsonb_typeof(v_topics) <> 'array'
     or jsonb_typeof(v_grade4->'outcomes') <> 'array' then
    raise exception 'Filtered HQ topic/outcome response invalid';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_grade4->'outcomes') o
    where o->>'grade' <> 'Grade 4' or o->>'subject' <> 'Mathematics'
  ) then
    raise exception 'Filtered response contains a different subject';
  end if;
end
$test$;
rollback;
