begin;

create table if not exists public.teacher_school_claims (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique default ('VS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id) on delete restrict,
  directory_school_id uuid references public.schools_directory(id) on delete restrict,
  requested_levels text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','needs_information','approved','rejected','cancelled','expired')),
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_school_claim_has_target check (num_nonnulls(school_id,directory_school_id) >= 1),
  constraint teacher_school_claim_levels check (requested_levels <@ array['PRIMARY','JUNIOR','SENIOR_SECONDARY']::text[])
);

create unique index if not exists uq_teacher_school_claim_active
  on public.teacher_school_claims(
    teacher_id,
    coalesce(school_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(directory_school_id,'00000000-0000-0000-0000-000000000000'::uuid)
  ) where status in ('pending','needs_information');
create index if not exists idx_teacher_school_claim_queue on public.teacher_school_claims(status,created_at);
create index if not exists idx_teacher_school_claim_teacher on public.teacher_school_claims(teacher_id,created_at desc);

alter table public.teacher_school_claims enable row level security;
revoke all on table public.teacher_school_claims from public,anon;
grant select on table public.teacher_school_claims to authenticated;
drop policy if exists teacher_school_claims_read_own on public.teacher_school_claims;
create policy teacher_school_claims_read_own on public.teacher_school_claims
  for select to authenticated using (teacher_id=(select auth.uid()));

create or replace function public.submit_teacher_school_claim(
  p_school_id uuid default null,
  p_directory_school_id uuid default null,
  p_levels text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_levels text[];
  v_claim public.teacher_school_claims%rowtype;
  v_mapped uuid;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_uid and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
  ) then raise exception 'active_teacher_required' using errcode='42501'; end if;
  if num_nonnulls(p_school_id,p_directory_school_id)<>1 then
    raise exception 'exactly_one_school_claim_target_required' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct x order by x) filter (where x is not null),'{}')
    into v_levels from unnest(coalesce(p_levels,'{}')) x;
  if coalesce(array_length(v_levels,1),0)=0
     or not(v_levels <@ array['PRIMARY','JUNIOR','SENIOR_SECONDARY']::text[])
  then raise exception 'valid_requested_level_required' using errcode='22023'; end if;

  if p_school_id is not null and not exists(
    select 1 from public.schools s
    where s.id=p_school_id and s.deleted_at is null and s.status in ('pending','active')
  ) then raise exception 'school_not_available' using errcode='22023'; end if;

  if p_directory_school_id is not null then
    if not exists(
      select 1 from public.schools_directory d
      where d.id=p_directory_school_id and lower(coalesce(d.status,'active'))<>'closed'
    ) then raise exception 'directory_school_not_found' using errcode='22023'; end if;

    select c.canonical_school_id into v_mapped
    from public.school_identity_candidates c
    where c.directory_school_id=p_directory_school_id
      and c.canonical_school_id is not null
      and c.reviewed_by is not null
      and c.reviewed_at is not null
      and c.status in ('matched','new')
    order by c.reviewed_at desc
    limit 1;
  end if;

  select * into v_claim
  from public.teacher_school_claims c
  where c.teacher_id=v_uid
    and c.status in ('pending','needs_information')
    and c.school_id is not distinct from coalesce(p_school_id,v_mapped)
    and c.directory_school_id is not distinct from p_directory_school_id
  order by c.created_at desc
  limit 1;

  if found then
    update public.teacher_school_claims
      set requested_levels=v_levels,updated_at=now()
      where id=v_claim.id returning * into v_claim;
  else
    insert into public.teacher_school_claims(teacher_id,school_id,directory_school_id,requested_levels)
      values(v_uid,coalesce(p_school_id,v_mapped),p_directory_school_id,v_levels)
      returning * into v_claim;
  end if;

  return jsonb_build_object(
    'claim_id',v_claim.id,
    'reference_code',v_claim.reference_code,
    'status',v_claim.status,
    'school_id',v_claim.school_id,
    'directory_school_id',v_claim.directory_school_id
  );
end;
$$;

-- Compatibility wrappers intentionally preserve old signatures while removing the old
-- privilege-escalation behaviour. They now create claims only; they never mint authority.
create or replace function public.connect_teacher_to_school(p_school_id uuid,p_level text default null)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v jsonb;
begin
  if p_level is null then raise exception 'valid_requested_level_required' using errcode='22023'; end if;
  v:=public.submit_teacher_school_claim(p_school_id,null,array[p_level]);
  return (v->>'claim_id')::uuid;
end;
$$;

create or replace function public.connect_teacher_to_directory_school(p_directory_id uuid,p_level text default null)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v jsonb;
begin
  if p_level is null then raise exception 'valid_requested_level_required' using errcode='22023'; end if;
  v:=public.submit_teacher_school_claim(null,p_directory_id,array[p_level]);
  return (v->>'claim_id')::uuid;
end;
$$;

create or replace function public.get_my_teacher_school_claim()
returns jsonb language sql stable security definer set search_path=public,auth,pg_temp as $$
  select coalesce((
    select jsonb_build_object(
      'claim_id',c.id,'reference_code',c.reference_code,'status',c.status,
      'requested_levels',c.requested_levels,'school_name',coalesce(s.name,d.name),
      'review_note',case when c.status in ('needs_information','rejected') then c.review_note else null end,
      'created_at',c.created_at,'updated_at',c.updated_at
    )
    from public.teacher_school_claims c
    left join public.schools s on s.id=c.school_id
    left join public.schools_directory d on d.id=c.directory_school_id
    where c.teacher_id=auth.uid()
    order by c.created_at desc limit 1
  ),'{}'::jsonb)
$$;

create or replace function public.review_teacher_school_claim(p_claim_id uuid,p_action text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare
  v_uid uuid:=auth.uid();
  c public.teacher_school_claims%rowtype;
  v_school uuid;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_action not in ('approved','rejected','needs_information') then
    raise exception 'invalid_review_action' using errcode='22023';
  end if;

  select * into c from public.teacher_school_claims where id=p_claim_id for update;
  if not found then raise exception 'claim_not_found' using errcode='22023'; end if;
  if c.status not in ('pending','needs_information') then
    raise exception 'claim_already_resolved' using errcode='22023';
  end if;

  v_school:=c.school_id;
  if v_school is null and c.directory_school_id is not null then
    select x.canonical_school_id into v_school
    from public.school_identity_candidates x
    where x.directory_school_id=c.directory_school_id
      and x.canonical_school_id is not null
      and x.reviewed_by is not null
      and x.reviewed_at is not null
      and x.status in ('matched','new')
    order by x.reviewed_at desc limit 1;
  end if;

  if not(
    coalesce(public.is_platform_owner(),false)
    or (v_school is not null and public.is_school_admin(v_school))
  ) then raise exception 'claim_reviewer_authority_required' using errcode='42501'; end if;
  if p_action='approved' and v_school is null then
    raise exception 'canonical_school_resolution_required' using errcode='22023';
  end if;

  update public.teacher_school_claims
    set status=p_action,
        school_id=coalesce(school_id,v_school),
        review_note=nullif(trim(coalesce(p_note,'')),''),
        reviewed_by=v_uid,
        reviewed_at=now(),
        updated_at=now()
    where id=c.id;

  if p_action='approved' then
    insert into public.school_members(school_id,profile_id,role)
      values(v_school,c.teacher_id,'teacher')
      on conflict(school_id,profile_id) do update set role='teacher';
    update public.profiles set school_id=v_school where id=c.teacher_id;
    insert into public.teacher_profiles(profile_id,school_id)
      values(c.teacher_id,v_school)
      on conflict(profile_id) do update set school_id=excluded.school_id,updated_at=now();
  end if;

  return jsonb_build_object('claim_id',c.id,'status',p_action,'school_id',v_school);
end;
$$;

revoke all on function public.submit_teacher_school_claim(uuid,uuid,text[]) from public,anon;
revoke all on function public.connect_teacher_to_school(uuid,text) from public,anon;
revoke all on function public.connect_teacher_to_directory_school(uuid,text) from public,anon;
revoke all on function public.get_my_teacher_school_claim() from public,anon;
revoke all on function public.review_teacher_school_claim(uuid,text,text) from public,anon;
grant execute on function public.submit_teacher_school_claim(uuid,uuid,text[]) to authenticated;
grant execute on function public.connect_teacher_to_school(uuid,text) to authenticated;
grant execute on function public.connect_teacher_to_directory_school(uuid,text) to authenticated;
grant execute on function public.get_my_teacher_school_claim() to authenticated;
grant execute on function public.review_teacher_school_claim(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
commit;