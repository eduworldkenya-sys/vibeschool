-- Maintain Scheme-linked teacher access after original Grade 1 Jumping content
-- becomes certified. Supports both draft and certified sources, but never
-- widens teacher/class authorization or learner RLS.
-- Safe to reapply if the production operator migration ran before Git merge.
begin;
do $grade1_release_compat$
declare
  old_definition text;
  new_definition text;
begin
  old_definition := pg_get_functiondef('public.vs_read_linked_jumping_scheme_content(uuid,integer)'::regprocedure);
  if old_definition is null then
    raise exception 'GRADE1_JUMPING_READER_MISSING';
  end if;
  if strpos(old_definition, 'version.lifecycle_status in (''candidate'',''certified'')') = 0 then
    if strpos(old_definition, 'version.lifecycle_status=''candidate''') = 0
       or strpos(old_definition, 'r.status=''inactive''') = 0
       or strpos(old_definition, 'r.visibility=''private''') = 0 then
      raise exception 'GRADE1_JUMPING_READER_CONTRACT_CHANGED';
    end if;
    new_definition := replace(old_definition,
      'version.lifecycle_status=''candidate''',
      'version.lifecycle_status in (''candidate'',''certified'')');
    new_definition := replace(new_definition,
      'r.status=''inactive''',
      '(r.status=''inactive'' or (r.status=''active'' and r.canonical_key like ''vs:g1:jumping:learner:%''))');
    new_definition := replace(new_definition,
      'r.visibility=''private''',
      '(r.visibility=''private'' or (r.visibility=''public'' and r.canonical_key like ''vs:g1:jumping:learner:%''))');
    execute new_definition;
  elsif strpos(old_definition, 'vs:g1:jumping:learner:%') = 0 then
    raise exception 'GRADE1_JUMPING_READER_PUBLISHED_LEARNER_CONTRACT_MISSING';
  end if;

  old_definition := pg_get_functiondef('public.vs_pin_jumping_draft_to_plan(uuid,uuid,integer)'::regprocedure);
  if old_definition is null then
    raise exception 'GRADE1_JUMPING_PIN_MISSING';
  end if;
  if strpos(old_definition, 'rv.lifecycle_status in (''candidate'',''certified'')') = 0 then
    if strpos(old_definition, 'rv.lifecycle_status=''candidate''') = 0
       or strpos(old_definition, 'r.status=''inactive''') = 0
       or strpos(old_definition, 'r.visibility=''private''') = 0 then
      raise exception 'GRADE1_JUMPING_PIN_CONTRACT_CHANGED';
    end if;
    new_definition := replace(old_definition,
      'rv.lifecycle_status=''candidate''',
      'rv.lifecycle_status in (''candidate'',''certified'')');
    new_definition := replace(new_definition,
      'r.status=''inactive''',
      '(r.status=''inactive'' or (r.status=''active'' and r.canonical_key like ''vs:g1:jumping:learner:%''))');
    new_definition := replace(new_definition,
      'r.visibility=''private''',
      '(r.visibility=''private'' or (r.visibility=''public'' and r.canonical_key like ''vs:g1:jumping:learner:%''))');
    execute new_definition;
  elsif strpos(old_definition, 'vs:g1:jumping:learner:%') = 0 then
    raise exception 'GRADE1_JUMPING_PIN_PUBLISHED_LEARNER_CONTRACT_MISSING';
  end if;
end;
$grade1_release_compat$;
commit;
