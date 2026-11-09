-- EX-11: Marking and review currently read mutable live assessment_items.
-- Once any attempt exists, keep the assessment's item set and key immutable.
-- Corrections must create a new assessment definition/version, not mutate
-- the questions already delivered to learners.
create index if not exists idx_exq_attempts_assessment_revision_lock
  on public.assessment_attempts(assessment_id);

create or replace function public.exq_protect_attempted_assessment_items()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_assessment_id uuid;
begin
  v_assessment_id := case when tg_op='INSERT' then new.assessment_id else old.assessment_id end;
  if tg_op='UPDATE' then
    if new.assessment_id is distinct from old.assessment_id then
      raise exception 'assessment_item_cannot_change_parent';
    end if;
  end if;
  if exists (
    select 1 from public.assessment_attempts a
    where a.assessment_id=v_assessment_id
    limit 1
  ) then
    if tg_op in ('DELETE','INSERT') then
      raise exception 'assessment_item_revision_locked_create_new_assessment';
    elsif tg_op='UPDATE' then
      if to_jsonb(old) is distinct from to_jsonb(new) then
        raise exception 'assessment_item_revision_locked_create_new_assessment';
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;
revoke all on function public.exq_protect_attempted_assessment_items() from public, anon, authenticated;
drop trigger if exists trg_exq_protect_attempted_items on public.assessment_items;
create trigger trg_exq_protect_attempted_items
before insert or update or delete on public.assessment_items
for each row execute function public.exq_protect_attempted_assessment_items();
