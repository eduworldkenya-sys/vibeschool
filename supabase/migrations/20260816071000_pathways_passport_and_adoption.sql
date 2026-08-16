-- VibeSchool Pathways P0.2/P0.5 — learner-owned pathway persistence.
-- Anonymous quick-check answers remain on-device. Nothing enters this domain until
-- an authenticated learner explicitly chooses to save/adopt the result.

create table public.student_pathway_decisions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id),
  decision_type text not null check (decision_type in ('quick_check_saved','adopted','changed','reviewed')),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rule_version text not null,
  idempotency_key text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(student_id, idempotency_key)
);
alter table public.student_pathway_decisions enable row level security;
revoke all on table public.student_pathway_decisions from public, anon, authenticated;
grant select on table public.student_pathway_decisions to authenticated;
grant select, insert, update, delete on table public.student_pathway_decisions to service_role;
create policy student_pathway_decisions_own_read on public.student_pathway_decisions
  for select to authenticated using (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = (select auth.uid()) and s.deleted_at is null
    )
  );
-- authorization-test: public.student_pathway_decisions anon denied; authenticated learner reads own history only; direct writes denied

create table public.student_pathway_passports (
  student_id uuid primary key references public.students(id) on delete cascade,
  adopted_pathway_id uuid not null references public.pathways(id),
  source_decision_id uuid not null references public.student_pathway_decisions(id),
  evidence_type text not null default 'quick_check' check (evidence_type in ('quick_check','learner_choice','guided_review')),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rule_version text not null,
  adopted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.student_pathway_passports enable row level security;
revoke all on table public.student_pathway_passports from public, anon, authenticated;
grant select on table public.student_pathway_passports to authenticated;
grant select, insert, update, delete on table public.student_pathway_passports to service_role;
create policy student_pathway_passports_own_read on public.student_pathway_passports
  for select to authenticated using (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = (select auth.uid()) and s.deleted_at is null
    )
  );
-- authorization-test: public.student_pathway_passports anon denied; authenticated learner reads own passport only; direct writes denied

create index student_pathway_decisions_student_created_idx
  on public.student_pathway_decisions(student_id, created_at desc);

create or replace function public.student_adopt_pathway_quick_check(
  p_pathway_slug text,
  p_answers jsonb,
  p_scores jsonb,
  p_rule_version text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  caller uuid := auth.uid();
  learner public.students%rowtype;
  chosen public.pathways%rowtype;
  decision_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_pathway_slug is null or length(trim(p_pathway_slug)) = 0 then raise exception 'pathway_required'; end if;
  if p_rule_version is null or length(p_rule_version) > 80 then raise exception 'invalid_rule_version'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then raise exception 'invalid_idempotency_key'; end if;
  if pg_column_size(coalesce(p_answers, '{}'::jsonb)) > 16384 then raise exception 'answers_too_large'; end if;
  if pg_column_size(coalesce(p_scores, '{}'::jsonb)) > 4096 then raise exception 'scores_too_large'; end if;

  select * into learner
  from public.students
  where profile_id = caller and deleted_at is null
  limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;

  select * into chosen
  from public.pathways
  where slug = trim(lower(p_pathway_slug)) and status = 'published'
  limit 1;
  if not found then raise exception 'published_pathway_not_found'; end if;

  insert into public.student_pathway_decisions(
    student_id, pathway_id, decision_type, evidence_snapshot,
    rule_version, idempotency_key, created_by
  ) values (
    learner.id,
    chosen.id,
    'quick_check_saved',
    jsonb_build_object(
      'evidence_class','learner_supplied_quick_check',
      'answers',coalesce(p_answers,'{}'::jsonb),
      'scores',coalesce(p_scores,'{}'::jsonb),
      'disclaimer','Early VibeSchool guidance; not an official placement decision.'
    ),
    p_rule_version,
    p_idempotency_key,
    caller
  )
  on conflict (student_id, idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning id into decision_id;

  insert into public.student_pathway_passports(
    student_id, adopted_pathway_id, source_decision_id,
    evidence_type, evidence_snapshot, rule_version, adopted_at, updated_at
  ) values (
    learner.id,
    chosen.id,
    decision_id,
    'quick_check',
    jsonb_build_object(
      'evidence_class','learner_supplied_quick_check',
      'scores',coalesce(p_scores,'{}'::jsonb)
    ),
    p_rule_version,
    now(),
    now()
  )
  on conflict (student_id) do update set
    adopted_pathway_id = excluded.adopted_pathway_id,
    source_decision_id = excluded.source_decision_id,
    evidence_type = excluded.evidence_type,
    evidence_snapshot = excluded.evidence_snapshot,
    rule_version = excluded.rule_version,
    adopted_at = excluded.adopted_at,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'student_id', learner.id,
    'pathway_id', chosen.id,
    'pathway_slug', chosen.slug,
    'pathway_name', chosen.name,
    'decision_id', decision_id,
    'saved_at', now()
  );
end;
$function$;

revoke all on function public.student_adopt_pathway_quick_check(text,jsonb,jsonb,text,text) from public, anon;
grant execute on function public.student_adopt_pathway_quick_check(text,jsonb,jsonb,text,text) to authenticated;

create or replace function public.student_get_pathway_passport()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select coalesce((
    select jsonb_build_object(
      'student_id', pp.student_id,
      'pathway_id', p.id,
      'pathway_slug', p.slug,
      'pathway_name', p.name,
      'summary', p.plain_language_summary,
      'evidence_type', pp.evidence_type,
      'evidence_snapshot', pp.evidence_snapshot,
      'rule_version', pp.rule_version,
      'adopted_at', pp.adopted_at,
      'reviewed_at', pp.reviewed_at,
      'updated_at', pp.updated_at
    )
    from public.student_pathway_passports pp
    join public.students s on s.id = pp.student_id and s.deleted_at is null
    join public.pathways p on p.id = pp.adopted_pathway_id
    where s.profile_id = auth.uid()
    limit 1
  ), 'null'::jsonb);
$function$;

revoke all on function public.student_get_pathway_passport() from public, anon;
grant execute on function public.student_get_pathway_passport() to authenticated;
