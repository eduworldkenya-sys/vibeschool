-- Append-only revocation closes assessor authorization without rewriting history.
-- access: owner-only public.hq_workforce_dependency_assessor_revocations
-- authorization-test: public.hq_workforce_dependency_assessor_revocations denies direct product and service-role writes

create table public.hq_workforce_dependency_assessor_revocations (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.hq_workforce_dependency_assessor_authorizations(id),
  reason text not null check (length(trim(reason))>0),
  revoked_by text not null check (length(trim(revoked_by))>0),
  evidence_refs text[] not null check (cardinality(evidence_refs)>0),
  revoked_at timestamptz not null default clock_timestamp(),
  unique(authorization_id)
);
alter table public.hq_workforce_dependency_assessor_revocations enable row level security;
create trigger hq_workforce_dependency_assessor_revocations_append_only
before update or delete on public.hq_workforce_dependency_assessor_revocations
for each row execute function public.hq_workforce_reject_evidence_mutation();
revoke all on table public.hq_workforce_dependency_assessor_revocations from public,anon,authenticated;
revoke insert,update,delete on table public.hq_workforce_dependency_assessor_revocations from service_role;
grant select on table public.hq_workforce_dependency_assessor_revocations to service_role;

create or replace function public.hq_workforce_owner_revoke_dependency_assessor(p_authorization_id uuid,p_reason text,p_evidence_refs text[])
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_uid uuid;
begin
  perform public.hq_assert_owner(); v_uid:=auth.uid();
  if nullif(trim(p_reason),'') is null or cardinality(coalesce(p_evidence_refs,'{}'))=0 then raise exception 'dependency_assessor_revocation_evidence_required'; end if;
  if not exists(select 1 from public.hq_workforce_dependency_assessor_authorizations where id=p_authorization_id) then raise exception 'dependency_assessor_authorization_not_found'; end if;
  insert into public.hq_workforce_dependency_assessor_revocations(authorization_id,reason,revoked_by,evidence_refs) values(p_authorization_id,p_reason,v_uid::text,p_evidence_refs) returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_workforce_dependency_assessor_is_authorized(p_worker_key text,p_checkpoint_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.hq_workforce_dependency_assessor_authorizations a
    where a.worker_key=p_worker_key and a.scope_type='dependency_integrity'
      and a.scope_key in ('*',p_checkpoint_id::text)
      and a.revoked_at is null and a.valid_from<=clock_timestamp() and a.valid_until>clock_timestamp()
      and not exists(select 1 from public.hq_workforce_dependency_assessor_revocations r where r.authorization_id=a.id)
  )
$$;

revoke all on function public.hq_workforce_owner_revoke_dependency_assessor(uuid,text,text[]) from public,anon;
grant execute on function public.hq_workforce_owner_revoke_dependency_assessor(uuid,text,text[]) to authenticated;
