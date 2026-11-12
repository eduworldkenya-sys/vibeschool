-- Scheme outcome lineage: extend the existing curriculum / scheme / lesson authority.
-- Intent: exact-ID-only automatic repair, safe source-driven hydration, delivery
-- guardrails, and a RLS-respecting reconciliation view. No new content authority.
-- Existing historical rows, lesson IDs and teaching evidence are never deleted.
begin;

create or replace function public.scheme_outcome_lineage_before_write()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  v_outcome public.curriculum_learning_outcomes%rowtype;
  v_candidate uuid;
  v_count integer;
  v_sub_strand uuid;
  v_status_transition boolean := false;
begin
  -- Existing scheme generation supplies a canonical curriculum item but
  -- previously left its specific outcome empty. Hydrate ONLY when that same
  -- curriculum item and sub-strand identify ONE source-verified outcome.
  -- Never infer an outcome from a title, topic, grade or similar wording.
  if new.curriculum_outcome_id is null
     and new.curriculum_id is not null
     and new.source = 'curriculum'
     and coalesce(new.status,'planned') = 'planned'
  then
    select coalesce(new.sub_strand_id,c.sub_strand_id)
      into v_sub_strand
    from public.curriculum c where c.id=new.curriculum_id;
    if v_sub_strand is not null then
      select count(*),min(o.id::text)::uuid into v_count,v_candidate
      from public.curriculum_learning_outcomes o
      where o.curriculum_id=new.curriculum_id
        and o.sub_strand_id=v_sub_strand
        and o.status='verified'
        and o.verified_at is not null
        and nullif(btrim(o.source_locator),'') is not null;
      if v_count=1 then new.curriculum_outcome_id:=v_candidate; end if;
    end if;
  end if;

  -- Preserve historical fields on unrelated updates, while validating new
  -- or changed explicit identities before persistence.
  if new.curriculum_outcome_id is not null then
    select * into v_outcome
    from public.curriculum_learning_outcomes o
    where o.id=new.curriculum_outcome_id;
    if not found or v_outcome.status not in ('active','verified') then
      raise exception 'SCHEME_OUTCOME_INACTIVE_OR_UNKNOWN' using errcode='23514';
    end if;
    if new.sub_strand_id is not null
       and v_outcome.sub_strand_id is distinct from new.sub_strand_id then
      raise exception 'SCHEME_OUTCOME_SUBSTRAND_MISMATCH' using errcode='23514';
    end if;
    if new.curriculum_id is not null
       and v_outcome.curriculum_id is not null
       and v_outcome.curriculum_id is distinct from new.curriculum_id then
      raise exception 'SCHEME_OUTCOME_CURRICULUM_MISMATCH' using errcode='23514';
    end if;
  end if;

  if tg_op='INSERT' then
    v_status_transition := new.status in ('teaching','done');
  else
    -- Existing in-progress lessons can complete without rewriting history.
    -- New starts and direct planned->done transitions need real outcome IDs.
    v_status_transition :=
      (new.status in ('teaching','done') and
       old.status is distinct from new.status and
       old.status is distinct from 'teaching');
  end if;
  if v_status_transition and new.curriculum_outcome_id is null
     and not exists (
       select 1 from public.scheme_lesson_outcomes slo
       where slo.scheme_lesson_id=new.id
     )
  then
    raise exception 'SCHEME_OUTCOME_REQUIRED_BEFORE_TEACHING'
      using errcode='23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists zzz_scheme_outcome_lineage_guard on public.scheme_of_work;
create trigger zzz_scheme_outcome_lineage_guard
before insert or update of curriculum_id,sub_strand_id,curriculum_outcome_id,status,source
on public.scheme_of_work
for each row execute function public.scheme_outcome_lineage_before_write();

-- Reject future mismatched junction links (the direct primary can legitimately
-- be one of multiple selected outcomes). This is an invoker trigger: it does
-- not expand the existing tenant or author permissions.
create or replace function public.scheme_lesson_outcome_identity_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  v_scheme public.scheme_of_work%rowtype;
  v_outcome public.curriculum_learning_outcomes%rowtype;
begin
  select * into v_scheme from public.scheme_of_work
  where id=new.scheme_lesson_id;
  select * into v_outcome from public.curriculum_learning_outcomes
  where id=new.curriculum_outcome_id;
  if v_scheme.id is null or v_outcome.id is null
     or v_outcome.status not in ('active','verified') then
    raise exception 'SCHEME_OUTCOME_LINK_INVALID' using errcode='23514';
  end if;
  if v_scheme.sub_strand_id is not null
     and v_scheme.sub_strand_id is distinct from v_outcome.sub_strand_id then
    raise exception 'SCHEME_LINK_SUBSTRAND_MISMATCH' using errcode='23514';
  end if;
  if v_scheme.curriculum_id is not null and v_outcome.curriculum_id is not null
     and v_scheme.curriculum_id is distinct from v_outcome.curriculum_id then
    raise exception 'SCHEME_LINK_CURRICULUM_MISMATCH' using errcode='23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists scheme_outcome_identity_guard on public.scheme_lesson_outcomes;
create trigger scheme_outcome_identity_guard
before insert or update of curriculum_outcome_id,scheme_lesson_id
on public.scheme_lesson_outcomes
for each row execute function public.scheme_lesson_outcome_identity_guard();

-- Recover an exact saved identity from a SINGLE existing junction link only.
-- Does not write to teaching/done records or select among multiple outcomes.
with singles as (
  select slo.scheme_lesson_id,min(slo.curriculum_outcome_id::text)::uuid as outcome_id
  from public.scheme_lesson_outcomes slo
  group by slo.scheme_lesson_id having count(*)=1
), admissible as (
  select s.id,si.outcome_id
  from public.scheme_of_work s
  join singles si on si.scheme_lesson_id=s.id
  join public.curriculum_learning_outcomes o on o.id=si.outcome_id
  where s.curriculum_outcome_id is null and s.status='planned'
    and o.status in ('active','verified')
    and (s.sub_strand_id is null or s.sub_strand_id=o.sub_strand_id)
    and (s.curriculum_id is null or o.curriculum_id is null or s.curriculum_id=o.curriculum_id)
)
update public.scheme_of_work s set curriculum_outcome_id=a.outcome_id
from admissible a where s.id=a.id and s.curriculum_outcome_id is null;

-- Read-only, live reconciliation inventory; teacher/administrator access
-- remains governed by the existing underlying RLS policies.
create or replace view public.scheme_outcome_reconciliation_status
with (security_invoker=true) as
select
  s.id as scheme_id,s.school_id,s.teacher_id,s.class_id,s.subject_id,
  s.grade,s.subject,s.term,s.week,s.topic,s.status as scheme_status,
  s.source,s.curriculum_id,s.sub_strand_id,s.curriculum_outcome_id,
  coalesce(j.link_count,0)::integer as junction_outcome_count,
  o.status as primary_outcome_status,
  case
    when s.curriculum_outcome_id is null and coalesce(j.link_count,0)=0
      then 'OUTCOME_MISSING'
    when s.curriculum_outcome_id is null and j.link_count=1
      then 'PRIMARY_MISSING'
    when s.curriculum_outcome_id is null
      then 'PRIMARY_SELECTION_REQUIRED'
    when o.id is null or o.status not in ('active','verified')
      then 'OUTCOME_INACTIVE_OR_UNAVAILABLE'
    when s.sub_strand_id is not null
       and o.sub_strand_id is distinct from s.sub_strand_id
      then 'SUBSTRAND_MISMATCH'
    when s.curriculum_id is not null and o.curriculum_id is not null
       and o.curriculum_id is distinct from s.curriculum_id
      then 'CURRICULUM_MISMATCH'
    when o.status='verified' and o.verified_at is not null
       and nullif(btrim(o.source_locator),'') is not null
      then 'SOURCE_VERIFIED_LINKED'
    else 'LINKED_SOURCE_VERIFICATION_PENDING'
  end::text as reconciliation_state
from public.scheme_of_work s
left join lateral (
  select count(*) as link_count from public.scheme_lesson_outcomes slo
  where slo.scheme_lesson_id=s.id
) j on true
left join public.curriculum_learning_outcomes o
  on o.id=s.curriculum_outcome_id;

revoke all on public.scheme_outcome_reconciliation_status from public,anon;
grant select on public.scheme_outcome_reconciliation_status to authenticated;

commit;
