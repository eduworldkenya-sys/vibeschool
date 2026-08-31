-- Repair canonical curriculum hierarchy linkage for the verified Grade 6 Social Studies Revised 2024 source.
-- This deliberately does not auto-canonicalize unrelated legacy curricula whose authority needs separate review.

insert into public.cbc_strands (
  subject_id,
  grade,
  name,
  sub_strand,
  term,
  week,
  source_ref
)
select distinct
  c.global_subject_id,
  c.grade,
  c.strand,
  c.sub_strand,
  c.term,
  null::integer,
  c.reference
from public.curriculum c
where c.curriculum = 'CBC Primary Social Studies Revised 2024'
  and c.grade = 'Grade 6'
  and c.subject = 'Social Studies'
  and c.global_subject_id is not null
  and c.strand is not null
  and c.sub_strand is not null
  and c.reference is not null
on conflict (subject_id, grade, name, sub_strand) do update
set source_ref = coalesce(public.cbc_strands.source_ref, excluded.source_ref);

update public.curriculum c
set sub_strand_id = cs.id
from public.cbc_strands cs
where c.curriculum = 'CBC Primary Social Studies Revised 2024'
  and c.grade = 'Grade 6'
  and c.subject = 'Social Studies'
  and c.sub_strand_id is null
  and cs.subject_id = c.global_subject_id
  and cs.grade = c.grade
  and cs.name = c.strand
  and cs.sub_strand = c.sub_strand;

-- Any Scheme row linked to an already-canonical curriculum row must inherit
-- that stable hierarchy identity. This is safe because both columns reference
-- cbc_strands(id) and production had zero conflicting non-null bindings before this repair.
update public.scheme_of_work s
set sub_strand_id = c.sub_strand_id
from public.curriculum c
where s.curriculum_id = c.id
  and s.sub_strand_id is null
  and c.sub_strand_id is not null;

create or replace function public.sync_scheme_sub_strand_from_curriculum()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sub_strand_id uuid;
begin
  if new.curriculum_id is null then
    return new;
  end if;

  select c.sub_strand_id
  into v_sub_strand_id
  from public.curriculum c
  where c.id = new.curriculum_id;

  if v_sub_strand_id is null then
    return new;
  end if;

  if new.sub_strand_id is null then
    new.sub_strand_id := v_sub_strand_id;
    return new;
  end if;

  if new.sub_strand_id <> v_sub_strand_id then
    raise exception using
      errcode = '23514',
      message = 'scheme_of_work sub_strand_id conflicts with its curriculum canonical identity';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_scheme_sync_sub_strand_from_curriculum on public.scheme_of_work;
create trigger trg_scheme_sync_sub_strand_from_curriculum
before insert or update of curriculum_id, sub_strand_id
on public.scheme_of_work
for each row
execute function public.sync_scheme_sub_strand_from_curriculum();

create or replace function public.propagate_curriculum_sub_strand_to_scheme()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sub_strand_id is not null
     and new.sub_strand_id is distinct from old.sub_strand_id then
    update public.scheme_of_work
    set sub_strand_id = new.sub_strand_id
    where curriculum_id = new.id
      and sub_strand_id is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_curriculum_propagate_sub_strand_to_scheme on public.curriculum;
create trigger trg_curriculum_propagate_sub_strand_to_scheme
after update of sub_strand_id
on public.curriculum
for each row
execute function public.propagate_curriculum_sub_strand_to_scheme();
