-- Issue #1984. Additive identity registry; no existing authority or school records changed.
-- Existing Twin relationship authority stays canonical; this migration creates no new role authority.
begin;

-- authorization-test: public.vs_identities — scripts/test-unified-identity-foundation.mjs; anonymous SELECT denied, owner sees only self
create table public.vs_identities (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid unique references auth.users(id) on delete cascade,
 username text unique,
 display_name text,
 kind text not null check(kind in ('person','managed_learner')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint vs_identity_username_format check(username is null or username ~ '^[a-z][a-z0-9_]{2,23}$'),
 constraint vs_identity_person_owner check(
  (kind='person' and auth_user_id is not null) or
  (kind='managed_learner' and auth_user_id is null))
);
-- authorization-test: public.vs_managed_learners — scripts/test-unified-identity-foundation.mjs; no read for non-guardian
create table public.vs_managed_learners (
 learner_identity_id uuid primary key references public.vs_identities(id) on delete restrict,
 guardian_identity_id uuid not null references public.vs_identities(id) on delete restrict,
 grade_label text,
 guardian_confirmed_at timestamptz not null,
 status text not null default 'managed' check(status in ('managed','link_pending','linked')),
 linked_student_id uuid unique references public.students(id) on delete set null,
 created_at timestamptz not null default now(),
 constraint no_self_guardianship check(learner_identity_id <> guardian_identity_id)
);
create index vs_managed_learners_guardian_idx on public.vs_managed_learners(guardian_identity_id);
-- access: service-only public.vs_username_reservations
-- authorization-test: public.vs_username_reservations — scripts/test-unified-identity-foundation.mjs; no direct client read/write
create table public.vs_username_reservations (
 username text primary key check(username ~ '^[a-z][a-z0-9_]{2,23}$'),
 reason text not null default 'reserved'
);
insert into public.vs_username_reservations(username)
select unnest(array['admin','administrator','support','vibeschool','vibetutor','vibeconnect','system','security','help','official','teacher','student','parent','moderator','staff']);

alter table public.vs_identities enable row level security;
alter table public.vs_managed_learners enable row level security;
alter table public.vs_username_reservations enable row level security;
revoke all on public.vs_identities,public.vs_managed_learners,public.vs_username_reservations from anon,authenticated;
grant select on public.vs_identities,public.vs_managed_learners to authenticated;

create policy vs_identity_self_read on public.vs_identities for select to authenticated
 using(auth_user_id=(select auth.uid()));
create policy vs_managed_guardian_read on public.vs_managed_learners for select to authenticated
 using(exists(select 1 from public.vs_identities i where i.id=guardian_identity_id and i.auth_user_id=(select auth.uid())));

create function public.vs_claim_my_username(p_username text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare
 v_uid uuid:=auth.uid();
 v_username text:=lower(trim(leading '@' from trim(coalesce(p_username,''))));
 v_id uuid;
 v_old text;
 v_access jsonb;
begin
 if v_uid is null then raise exception 'Sign in required' using errcode='28000'; end if;
 if v_username !~ '^[a-z][a-z0-9_]{2,23}$' then
  raise exception 'Invalid username' using errcode='22023';
 end if;
 if exists(select 1 from public.vs_username_reservations where username=v_username) then
  raise exception 'Username unavailable' using errcode='23505';
 end if;
 v_access:=public.get_my_auth_access_state();
 if v_access->>'account_status'<>'active' or coalesce((v_access->>'is_anonymized')::boolean,true) then
  raise exception 'Account unavailable' using errcode='28000';
 end if;
 if not exists(select 1 from public.profiles where id=v_uid) then
  raise exception 'Account profile missing' using errcode='28000';
 end if;
 insert into public.vs_identities(auth_user_id,kind) values(v_uid,'person')
  on conflict(auth_user_id) do nothing;
 select id,username into v_id,v_old from public.vs_identities where auth_user_id=v_uid for update;
 if v_old is not null and v_old<>v_username then
  raise exception 'Username already set' using errcode='22023';
 end if;
 update public.vs_identities set username=v_username,updated_at=now() where id=v_id;
 return jsonb_build_object('identity_id',v_id,'username',v_username);
exception when unique_violation then
 raise exception 'Username unavailable' using errcode='23505';
end;
$$;
revoke all on function public.vs_claim_my_username(text) from public,anon;
grant execute on function public.vs_claim_my_username(text) to authenticated;

create function public.vs_list_my_identities()
returns jsonb language sql stable security definer set search_path=public,auth,pg_temp as $$
with mine as (
 select id,username,display_name,kind from public.vs_identities where auth_user_id=(select auth.uid())
), kids as (
 select i.id,i.username,i.display_name,i.kind
 from public.vs_managed_learners ml
 join mine m on ml.guardian_identity_id=m.id
 join public.vs_identities i on i.id=ml.learner_identity_id
)
select jsonb_build_object('self',(select to_jsonb(m) from mine m),
 'managed_learners',coalesce((select jsonb_agg(to_jsonb(k)) from kids k),'[]'::jsonb));
$$;
revoke all on function public.vs_list_my_identities() from public,anon;
grant execute on function public.vs_list_my_identities() to authenticated;

-- Managed learner records are NOT authenticated student sessions.
create function public.vs_create_managed_learner(p_username text,p_display_name text,p_grade text default null,p_guardian_confirmed boolean default false)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare
 v_uid uuid:=auth.uid();
 v_guardian uuid;
 v_child uuid;
 v_username text:=lower(trim(leading '@' from trim(coalesce(p_username,''))));
 v_access jsonb;
begin
 if v_uid is null then raise exception 'Sign in required' using errcode='28000'; end if;
 if v_username !~ '^[a-z][a-z0-9_]{2,23}$' or char_length(trim(coalesce(p_display_name,''))) not between 1 and 80 then
  raise exception 'Invalid learner details' using errcode='22023';
 end if;
 if char_length(coalesce(p_grade,''))>60 then raise exception 'Invalid grade' using errcode='22023'; end if;
 if p_guardian_confirmed is distinct from true then raise exception 'Guardian declaration required' using errcode='42501'; end if;
 if exists(select 1 from public.vs_username_reservations where username=v_username) then
  raise exception 'Username unavailable' using errcode='23505';
 end if;
 v_access:=public.get_my_auth_access_state();
 if v_access->>'account_status'<>'active' or coalesce((v_access->>'is_anonymized')::boolean,true) then
  raise exception 'Account unavailable' using errcode='28000';
 end if;
 if v_access->>'role' not in ('parent','teacher') then
  raise exception 'Verified adult account required' using errcode='42501';
 end if;
 if not exists (select 1 from auth.users where id=v_uid and email_confirmed_at is not null) then
  raise exception 'Verified email required' using errcode='42501';
 end if;
 select id into v_guardian from public.vs_identities where auth_user_id=v_uid and kind='person';
 if v_guardian is null then raise exception 'Set up username first' using errcode='22023'; end if;
 if (select count(*) from public.vs_managed_learners where guardian_identity_id=v_guardian) >= 20 then
  raise exception 'Managed learner limit reached' using errcode='54000';
 end if;
 insert into public.vs_identities(username,display_name,kind)
  values(v_username,trim(p_display_name),'managed_learner') returning id into v_child;
 insert into public.vs_managed_learners(learner_identity_id,guardian_identity_id,grade_label,guardian_confirmed_at)
  values(v_child,v_guardian,nullif(trim(coalesce(p_grade,'')),''),now());
 return jsonb_build_object('id',v_child,'username',v_username);
exception when unique_violation then
 raise exception 'Username unavailable' using errcode='23505';
end;
$$;
revoke all on function public.vs_create_managed_learner(text,text,text,boolean) from public,anon;
grant execute on function public.vs_create_managed_learner(text,text,text,boolean) to authenticated;
comment on table public.vs_identities is 'Additive identity registry; no domain role privileges';
comment on table public.vs_managed_learners is 'Guardian-managed placeholders, not independent logins';
notify pgrst,'reload schema';
commit;
