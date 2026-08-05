begin;

alter table public.assessment_responses
  add column if not exists revision integer not null default 1,
  add column if not exists client_id uuid null,
  add column if not exists client_updated_at timestamptz null;

alter table public.assessment_responses
  drop constraint if exists assessment_responses_revision_chk,
  add constraint assessment_responses_revision_chk check (revision > 0);

alter table public.assessment_attempts
  add column if not exists active_client_id uuid null,
  add column if not exists client_lease_expires_at timestamptz null,
  add column if not exists client_lease_updated_at timestamptz null;

alter table public.assessment_attempts
  drop constraint if exists assessment_attempts_client_lease_chk,
  add constraint assessment_attempts_client_lease_chk check (
    (active_client_id is null and client_lease_expires_at is null)
    or (active_client_id is not null and client_lease_expires_at is not null)
  );

create index if not exists assessment_attempts_client_lease_idx
  on public.assessment_attempts(client_lease_expires_at)
  where status='in_progress' and active_client_id is not null;

create or replace function public.exq_claim_attempt_client(
  p_attempt_id uuid,
  p_client_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  learner_id uuid;
  at public.assessment_attempts%rowtype;
  lease_until timestamptz:=now()+interval '75 seconds';
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_client_id is null then raise exception 'client_id_required'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into at from public.assessment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if at.student_id is distinct from learner_id then raise exception 'attempt_not_owned'; end if;
  if at.status<>'in_progress' then raise exception 'attempt_locked'; end if;

  if at.active_client_id is not null
     and at.active_client_id is distinct from p_client_id
     and at.client_lease_expires_at>now()
     and not p_force then
    return jsonb_build_object(
      'ok',false,
      'conflict',true,
      'active_elsewhere',true,
      'lease_expires_at',at.client_lease_expires_at
    );
  end if;

  update public.assessment_attempts
  set active_client_id=p_client_id,
      client_lease_expires_at=lease_until,
      client_lease_updated_at=now(),
      updated_at=now()
  where id=at.id;

  return jsonb_build_object(
    'ok',true,
    'conflict',false,
    'active_elsewhere',false,
    'client_id',p_client_id,
    'lease_expires_at',lease_until
  );
end;
$$;

create or replace function public.exq_release_attempt_client(
  p_attempt_id uuid,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  learner_id uuid;
  at public.assessment_attempts%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;
  select * into at from public.assessment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if at.student_id is distinct from learner_id then raise exception 'attempt_not_owned'; end if;

  if at.active_client_id=p_client_id then
    update public.assessment_attempts
    set active_client_id=null,
        client_lease_expires_at=null,
        client_lease_updated_at=now(),
        updated_at=now()
    where id=at.id;
  end if;

  return jsonb_build_object('ok',true,'released',at.active_client_id=p_client_id);
end;
$$;

create or replace function public.exq_save_response_v2(
  p_attempt_id uuid,
  p_assessment_item_id uuid,
  p_client_id uuid,
  p_expected_revision integer default null,
  p_response_value jsonb default 'null'::jsonb,
  p_response_text text default null,
  p_client_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  at public.assessment_attempts%rowtype;
  ai public.assessment_items%rowtype;
  learner_id uuid;
  current_response public.assessment_responses%rowtype;
  saved_response public.assessment_responses%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_client_id is null then raise exception 'client_id_required'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into at from public.assessment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if at.student_id is distinct from learner_id then raise exception 'attempt_not_owned'; end if;
  if at.status<>'in_progress' then raise exception 'attempt_locked'; end if;
  if at.expires_at is not null and at.expires_at<=now() then raise exception 'attempt_time_expired'; end if;
  if at.active_client_id is distinct from p_client_id
     or at.client_lease_expires_at is null
     or at.client_lease_expires_at<=now() then
    raise exception 'attempt_client_lease_required';
  end if;

  select * into ai
  from public.assessment_items
  where id=p_assessment_item_id and assessment_id=at.assessment_id and status='approved';
  if not found then raise exception 'assessment_item_not_found'; end if;

  select * into current_response
  from public.assessment_responses
  where attempt_id=at.id and assessment_item_id=ai.id
  for update;

  if found then
    if p_expected_revision is null or p_expected_revision<>current_response.revision then
      return jsonb_build_object(
        'ok',false,'conflict',true,'assessment_item_id',ai.id,
        'revision',current_response.revision,
        'response_value',current_response.response_value,
        'response_text',current_response.response_text,
        'saved_at',current_response.last_saved_at,
        'client_updated_at',current_response.client_updated_at
      );
    end if;

    update public.assessment_responses
    set response_value=coalesce(p_response_value,'null'::jsonb),
        response_text=p_response_text,
        status='saved',
        revision=revision+1,
        client_id=p_client_id,
        client_updated_at=coalesce(p_client_updated_at,now()),
        last_saved_at=now(),
        updated_at=now()
    where id=current_response.id
    returning * into saved_response;
  else
    if p_expected_revision is not null and p_expected_revision<>0 then
      return jsonb_build_object('ok',false,'conflict',true,'assessment_item_id',ai.id,'revision',0);
    end if;

    insert into public.assessment_responses(
      attempt_id,assessment_item_id,response_value,response_text,status,max_score,
      revision,client_id,client_updated_at,last_saved_at,updated_at
    ) values (
      at.id,ai.id,coalesce(p_response_value,'null'::jsonb),p_response_text,'saved',ai.marks,
      1,p_client_id,coalesce(p_client_updated_at,now()),now(),now()
    ) returning * into saved_response;
  end if;

  update public.assessment_attempts
  set last_saved_at=now(),
      client_lease_expires_at=now()+interval '75 seconds',
      client_lease_updated_at=now(),
      updated_at=now()
  where id=at.id;

  return jsonb_build_object(
    'ok',true,'conflict',false,'attempt_id',at.id,
    'assessment_item_id',ai.id,'revision',saved_response.revision,
    'saved_at',saved_response.last_saved_at,'expires_at',at.expires_at
  );
end;
$$;

revoke all on function public.exq_claim_attempt_client(uuid,uuid,boolean) from public,anon;
revoke all on function public.exq_release_attempt_client(uuid,uuid) from public,anon;
revoke all on function public.exq_save_response_v2(uuid,uuid,uuid,integer,jsonb,text,timestamptz) from public,anon;
grant execute on function public.exq_claim_attempt_client(uuid,uuid,boolean) to authenticated,service_role;
grant execute on function public.exq_release_attempt_client(uuid,uuid) to authenticated,service_role;
grant execute on function public.exq_save_response_v2(uuid,uuid,uuid,integer,jsonb,text,timestamptz) to authenticated,service_role;

commit;
