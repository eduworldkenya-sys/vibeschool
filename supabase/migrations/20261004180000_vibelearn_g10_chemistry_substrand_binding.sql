begin;

-- Close the Grade 10 Chemistry resource-to-sub-strand gap discovered in
-- production postflight for the VibeLearn semantic pilot.
--
-- The seven canonical chapter resources already have exact curriculum_id,
-- subject, grade and chapter-title authority. Their curriculum rows predate
-- sub_strand_id population, but each chapter title has exactly one matching
-- canonical Grade 10 Chemistry cbc_strands.sub_strand. Fail closed if that
-- one-to-one identity ever stops being true.

do $$
declare
  v_resource_count integer;
  v_exact_match_count integer;
begin
  select count(*)::integer
  into v_resource_count
  from public.learning_resources lr
  left join public.subjects s on s.id=lr.subject_id
  where lr.status='active'
    and lr.source_type='chapter'
    and lower(coalesce(lr.subject,s.name,''))='chemistry'
    and replace(lower(coalesce(lr.grade,'')),' ','')='grade10'
    and lr.title in (
      'Introduction to Chemistry','The Atom','The Periodic Table',
      'Chemical Bonding','Periodicity','Acids and Bases','Introduction to Salts'
    );

  -- Schema-only clean rebuilds deliberately omit content seed rows.
  -- In a populated environment, however, partial pilot data is unsafe.
  if v_resource_count = 0 then
    return;
  end if;

  if v_resource_count <> 7 then
    raise exception 'VIBELEARN_G10_CHEMISTRY_RESOURCE_COHORT_DRIFT: expected 0 or 7, found %',
      v_resource_count;
  end if;

  select count(*)::integer
  into v_exact_match_count
  from public.learning_resources lr
  left join public.subjects s on s.id=lr.subject_id
  where lr.status='active'
    and lr.source_type='chapter'
    and lower(coalesce(lr.subject,s.name,''))='chemistry'
    and replace(lower(coalesce(lr.grade,'')),' ','')='grade10'
    and lr.title in (
      'Introduction to Chemistry','The Atom','The Periodic Table',
      'Chemical Bonding','Periodicity','Acids and Bases','Introduction to Salts'
    )
    and (
      select count(*)
      from public.cbc_strands cs
      where cs.subject_id=lr.subject_id
        and lower(btrim(cs.grade))='grade 10'
        and lower(btrim(cs.sub_strand))=lower(btrim(lr.title))
    ) = 1;

  if v_exact_match_count <> 7 then
    raise exception 'VIBELEARN_G10_CHEMISTRY_SUBSTRAND_IDENTITY_AMBIGUOUS: expected 7 unique matches, found %',
      v_exact_match_count;
  end if;
end $$;

update public.learning_resources lr
set
  sub_strand_id = (
    select cs.id
    from public.cbc_strands cs
    where cs.subject_id=lr.subject_id
      and lower(btrim(cs.grade))='grade 10'
      and lower(btrim(cs.sub_strand))=lower(btrim(lr.title))
  ),
  updated_at = clock_timestamp()
where lr.status='active'
  and lr.source_type='chapter'
  and replace(lower(coalesce(lr.grade,'')),' ','')='grade10'
  and lower(coalesce(
    lr.subject,
    (select s.name from public.subjects s where s.id=lr.subject_id),
    ''
  ))='chemistry'
  and lr.title in (
    'Introduction to Chemistry','The Atom','The Periodic Table',
    'Chemical Bonding','Periodicity','Acids and Bases','Introduction to Salts'
  )
  and lr.sub_strand_id is null;

do $
declare
  v_resource_count integer;
  v_bound integer;
begin
  select count(*)::integer
  into v_resource_count
  from public.learning_resources lr
  left join public.subjects s on s.id=lr.subject_id
  where lr.status='active'
    and lr.source_type='chapter'
    and lower(coalesce(lr.subject,s.name,''))='chemistry'
    and replace(lower(coalesce(lr.grade,'')),' ','')='grade10'
    and lr.title in (
      'Introduction to Chemistry','The Atom','The Periodic Table',
      'Chemical Bonding','Periodicity','Acids and Bases','Introduction to Salts'
    );

  if v_resource_count = 0 then
    return;
  end if;

  select count(*)::integer
  into v_bound
  from public.learning_resources lr
  left join public.subjects s on s.id=lr.subject_id
  join public.cbc_strands cs on cs.id=lr.sub_strand_id
  where lr.status='active'
    and lr.source_type='chapter'
    and lower(coalesce(lr.subject,s.name,''))='chemistry'
    and replace(lower(coalesce(lr.grade,'')),' ','')='grade10'
    and lr.title in (
      'Introduction to Chemistry','The Atom','The Periodic Table',
      'Chemical Bonding','Periodicity','Acids and Bases','Introduction to Salts'
    )
    and cs.subject_id=lr.subject_id
    and lower(btrim(cs.grade))='grade 10'
    and lower(btrim(cs.sub_strand))=lower(btrim(lr.title));

  if v_bound <> 7 then
    raise exception 'VIBELEARN_G10_CHEMISTRY_SUBSTRAND_BINDING_INCOMPLETE: expected 7, found %',
      v_bound;
  end if;
end $$;

-- Keep later canonical Grade 10 Chemistry chapter registrations aligned with
-- the same deterministic identity rule. No public RPC is exposed.
create or replace function public.curriculum_bind_g10_chemistry_resource_substrand()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_subject_name text;
  v_match_count integer;
  v_match_id uuid;
begin
  if new.source_type <> 'chapter'
     or replace(lower(coalesce(new.grade,'')),' ','') <> 'grade10'
     or new.subject_id is null then
    return new;
  end if;

  select lower(coalesce(new.subject,s.name,''))
  into v_subject_name
  from public.subjects s
  where s.id=new.subject_id;

  if coalesce(v_subject_name,'') <> 'chemistry' then
    return new;
  end if;

  select count(*)::integer,(array_agg(cs.id order by cs.id::text))[1]
  into v_match_count,v_match_id
  from public.cbc_strands cs
  where cs.subject_id=new.subject_id
    and lower(btrim(cs.grade))='grade 10'
    and lower(btrim(cs.sub_strand))=lower(btrim(new.title));

  if v_match_count > 1 then
    raise exception 'VIBELEARN_G10_CHEMISTRY_SUBSTRAND_IDENTITY_AMBIGUOUS';
  end if;

  if v_match_count = 1 then
    new.sub_strand_id := v_match_id;
  end if;

  return new;
end;
$function$;

revoke all on function public.curriculum_bind_g10_chemistry_resource_substrand()
  from public,anon,authenticated;
grant execute on function public.curriculum_bind_g10_chemistry_resource_substrand()
  to service_role;

drop trigger if exists curriculum_bind_g10_chemistry_resource_substrand
  on public.learning_resources;
create trigger curriculum_bind_g10_chemistry_resource_substrand
before insert or update of subject_id,subject,grade,title,source_type
on public.learning_resources
for each row
execute function public.curriculum_bind_g10_chemistry_resource_substrand();

commit;
