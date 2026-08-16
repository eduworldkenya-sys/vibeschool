-- Safe acquisition bridge for a family arriving through public Pathways.
-- A parent may preserve an anonymous Pathways result as an adult-owned draft.
-- This never creates a learner, never creates a school membership, and never
-- silently writes the learner-owned Pathway Passport.

begin;

create table public.parent_pathway_drafts (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rule_version text not null,
  input_fingerprint text not null,
  idempotency_key text not null,
  status text not null default 'active' check (status in ('active','adopted_by_learner','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_profile_id,idempotency_key)
);
alter table public.parent_pathway_drafts enable row level security;
revoke all on table public.parent_pathway_drafts from public, anon, authenticated;
grant select on table public.parent_pathway_drafts to authenticated;
grant select, insert, update, delete on table public.parent_pathway_drafts to service_role;
create policy parent_pathway_drafts_own_read on public.parent_pathway_drafts
for select to authenticated using (parent_profile_id = (select auth.uid()));
-- authorization-test: parent can read only own drafts; all direct client writes denied.

create index parent_pathway_drafts_parent_status_idx
on public.parent_pathway_drafts(parent_profile_id,status,updated_at desc);

create or replace function public.parent_save_pathway_draft(
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
  chosen public.pathways%rowtype;
  existing public.parent_pathway_drafts%rowtype;
  fingerprint text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=caller and p.role='parent') then
    raise exception 'parent_role_required';
  end if;
  if p_pathway_slug is null or length(trim(p_pathway_slug))=0 then raise exception 'pathway_required'; end if;
  if p_rule_version is null or length(trim(p_rule_version))=0 or length(p_rule_version)>80 then raise exception 'invalid_rule_version'; end if;
  if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>128 then raise exception 'invalid_idempotency_key'; end if;
  if pg_column_size(coalesce(p_answers,'{}'::jsonb))>16384 then raise exception 'answers_too_large'; end if;
  if pg_column_size(coalesce(p_scores,'{}'::jsonb))>4096 then raise exception 'scores_too_large'; end if;

  select * into chosen from public.pathways where slug=lower(trim(p_pathway_slug)) and status='published' limit 1;
  if not found then raise exception 'published_pathway_not_found'; end if;

  fingerprint := encode(digest(convert_to(jsonb_build_object(
    'pathway_slug',chosen.slug,'answers',coalesce(p_answers,'{}'::jsonb),
    'scores',coalesce(p_scores,'{}'::jsonb),'rule_version',trim(p_rule_version)
  )::text,'UTF8'),'sha256'),'hex');

  select * into existing from public.parent_pathway_drafts
  where parent_profile_id=caller and idempotency_key=p_idempotency_key for update;

  if found then
    if existing.input_fingerprint<>fingerprint or existing.pathway_id<>chosen.id then
      raise exception 'idempotency_replay_mismatch';
    end if;
    return jsonb_build_object('ok',true,'draft_id',existing.id,'pathway_slug',chosen.slug,'pathway_name',chosen.name,'saved_at',existing.created_at,'replayed',true);
  end if;

  insert into public.parent_pathway_drafts(
    parent_profile_id,pathway_id,evidence_snapshot,rule_version,input_fingerprint,idempotency_key
  ) values (
    caller,chosen.id,
    jsonb_build_object('evidence_class','family_pathways_draft','answers',coalesce(p_answers,'{}'::jsonb),'scores',coalesce(p_scores,'{}'::jsonb),'notice','Parent-owned planning draft; not a learner Pathway Passport.'),
    trim(p_rule_version),fingerprint,p_idempotency_key
  ) returning * into existing;

  return jsonb_build_object('ok',true,'draft_id',existing.id,'pathway_slug',chosen.slug,'pathway_name',chosen.name,'saved_at',existing.created_at,'replayed',false);
end;
$function$;
revoke all on function public.parent_save_pathway_draft(text,jsonb,jsonb,text,text) from public, anon;
grant execute on function public.parent_save_pathway_draft(text,jsonb,jsonb,text,text) to authenticated;

commit;
