begin;

create table if not exists public.assessment_score_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  response_id uuid not null references public.assessment_responses(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  previous_score numeric null,
  new_score numeric null,
  previous_feedback text null,
  new_feedback text null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint assessment_score_events_type_chk check (event_type in ('teacher_mark','teacher_override','moderation_requested','moderation_approved','moderation_rejected')),
  constraint assessment_score_events_score_chk check ((previous_score is null or previous_score>=0) and (new_score is null or new_score>=0))
);

create table if not exists public.assessment_moderation_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  response_id uuid not null references public.assessment_responses(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_score numeric not null,
  request_reason text not null,
  status text not null default 'pending',
  reviewed_by uuid null references auth.users(id) on delete restrict,
  review_reason text null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_moderation_requests_status_chk check (status in ('pending','approved','rejected','cancelled')),
  constraint assessment_moderation_requests_score_chk check (requested_score>=0),
  constraint assessment_moderation_requests_reason_chk check (length(btrim(request_reason))>=5),
  constraint assessment_moderation_requests_review_state_chk check ((status='pending' and reviewed_by is null and reviewed_at is null) or (status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null) or status='cancelled')
);

create unique index if not exists assessment_moderation_one_pending_response_uidx on public.assessment_moderation_requests(response_id) where status='pending';
create index if not exists assessment_moderation_school_status_idx on public.assessment_moderation_requests(school_id,status,created_at);
create index if not exists assessment_score_events_response_idx on public.assessment_score_events(response_id,created_at);

alter table public.assessment_score_events enable row level security;
alter table public.assessment_moderation_requests enable row level security;

drop policy if exists assessment_score_events_read on public.assessment_score_events;
create policy assessment_score_events_read on public.assessment_score_events
for select to authenticated using (
  actor_id=(select auth.uid())
  or exists (select 1 from public.school_members sm where sm.school_id=assessment_score_events.school_id and sm.profile_id=(select auth.uid()) and sm.role in ('owner','admin'))
);

drop policy if exists assessment_moderation_requests_read on public.assessment_moderation_requests;
create policy assessment_moderation_requests_read on public.assessment_moderation_requests
for select to authenticated using (
  requested_by=(select auth.uid())
  or exists (select 1 from public.school_members sm where sm.school_id=assessment_moderation_requests.school_id and sm.profile_id=(select auth.uid()) and sm.role in ('owner','admin'))
);

create or replace function public.exq_request_moderation(p_response_id uuid,p_requested_score numeric,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); ar public.assessment_responses%rowtype; at public.assessment_attempts%rowtype; aa public.assessment_assignments%rowtype; request_id uuid; normalized_reason text:=btrim(coalesce(p_reason,''));
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if length(normalized_reason)<5 then raise exception 'moderation_reason_required'; end if;
  select * into ar from public.assessment_responses where id=p_response_id;
  if not found then raise exception 'response_not_found'; end if;
  select * into at from public.assessment_attempts where id=ar.attempt_id;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  if aa.teacher_id is distinct from caller then raise exception 'response_not_owned'; end if;
  if at.status='released' or at.result_status='released' then raise exception 'released_attempt_locked'; end if;
  if p_requested_score<0 or p_requested_score>ar.max_score then raise exception 'invalid_requested_score'; end if;
  if exists(select 1 from public.assessment_moderation_requests where response_id=ar.id and status='pending') then raise exception 'moderation_already_pending'; end if;
  insert into public.assessment_moderation_requests(school_id,attempt_id,response_id,requested_by,requested_score,request_reason)
  values(at.school_id,at.id,ar.id,caller,p_requested_score,normalized_reason) returning id into request_id;
  insert into public.assessment_score_events(school_id,attempt_id,response_id,actor_id,event_type,previous_score,new_score,reason)
  values(at.school_id,at.id,ar.id,caller,'moderation_requested',ar.final_score,p_requested_score,normalized_reason);
  return jsonb_build_object('ok',true,'request_id',request_id,'status','pending');
end;
$$;

create or replace function public.exq_list_moderation_queue()
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'request_id',mr.id,'response_id',mr.response_id,'attempt_id',mr.attempt_id,
    'assessment_title',ad.title,'student_name',s.name,'teacher_name',coalesce(p.full_name,p.email,'Teacher'),
    'prompt',ai.prompt,'current_score',ar.final_score,'requested_score',mr.requested_score,
    'max_score',ar.max_score,'request_reason',mr.request_reason,'created_at',mr.created_at
  ) order by mr.created_at asc),'[]'::jsonb)
  into payload
  from public.assessment_moderation_requests mr
  join public.assessment_attempts at on at.id=mr.attempt_id
  join public.assessment_assignments aa on aa.id=at.assignment_id
  join public.assessment_definitions ad on ad.id=at.assessment_id
  join public.assessment_responses ar on ar.id=mr.response_id
  join public.assessment_items ai on ai.id=ar.assessment_item_id
  join public.students s on s.id=at.student_id
  left join public.profiles p on p.id=mr.requested_by
  where mr.status='pending'
    and exists(select 1 from public.school_members sm where sm.school_id=mr.school_id and sm.profile_id=caller and sm.role in ('owner','admin'));
  return jsonb_build_object('ok',true,'requests',payload);
end;
$$;

create or replace function public.exq_review_moderation(p_request_id uuid,p_decision text,p_review_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); mr public.assessment_moderation_requests%rowtype; ar public.assessment_responses%rowtype; at public.assessment_attempts%rowtype; normalized_reason text:=btrim(coalesce(p_review_reason,'')); event_kind text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_moderation_decision'; end if;
  if length(normalized_reason)<5 then raise exception 'review_reason_required'; end if;
  select * into mr from public.assessment_moderation_requests where id=p_request_id for update;
  if not found then raise exception 'moderation_request_not_found'; end if;
  if mr.status<>'pending' then raise exception 'moderation_request_closed'; end if;
  if not exists(select 1 from public.school_members sm where sm.school_id=mr.school_id and sm.profile_id=caller and sm.role in ('owner','admin')) then raise exception 'moderator_not_authorized'; end if;
  select * into ar from public.assessment_responses where id=mr.response_id for update;
  select * into at from public.assessment_attempts where id=mr.attempt_id for update;
  if at.status='released' or at.result_status='released' then raise exception 'released_attempt_locked'; end if;
  if p_decision='approved' then
    if mr.requested_score<0 or mr.requested_score>ar.max_score then raise exception 'invalid_requested_score'; end if;
    update public.assessment_responses
    set teacher_score=mr.requested_score,final_score=mr.requested_score,
        teacher_override_reason=concat_ws(' | ',nullif(teacher_override_reason,''),'Moderation: '||normalized_reason),
        marked_by=caller,marked_at=now(),updated_at=now()
    where id=ar.id;
    event_kind:='moderation_approved';
  else event_kind:='moderation_rejected'; end if;
  update public.assessment_moderation_requests
  set status=p_decision,reviewed_by=caller,review_reason=normalized_reason,reviewed_at=now(),updated_at=now()
  where id=mr.id;
  insert into public.assessment_score_events(school_id,attempt_id,response_id,actor_id,event_type,previous_score,new_score,reason,metadata)
  values(mr.school_id,mr.attempt_id,mr.response_id,caller,event_kind,ar.final_score,
    case when p_decision='approved' then mr.requested_score else ar.final_score end,
    normalized_reason,jsonb_build_object('request_id',mr.id,'requested_score',mr.requested_score));
  return jsonb_build_object('ok',true,'request_id',mr.id,'status',p_decision);
end;
$$;

create or replace function public.exq_get_score_audit(p_response_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); school uuid; payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select at.school_id into school from public.assessment_responses ar join public.assessment_attempts at on at.id=ar.attempt_id where ar.id=p_response_id;
  if school is null then raise exception 'response_not_found'; end if;
  if not exists(select 1 from public.assessment_assignments aa join public.assessment_attempts at on at.assignment_id=aa.id join public.assessment_responses ar on ar.attempt_id=at.id where ar.id=p_response_id and aa.teacher_id=caller)
     and not exists(select 1 from public.school_members sm where sm.school_id=school and sm.profile_id=caller and sm.role in ('owner','admin')) then raise exception 'audit_not_authorized'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id',e.id,'event_type',e.event_type,'previous_score',e.previous_score,'new_score',e.new_score,
    'previous_feedback',e.previous_feedback,'new_feedback',e.new_feedback,'reason',e.reason,
    'actor_id',e.actor_id,'created_at',e.created_at,'metadata',e.metadata
  ) order by e.created_at asc),'[]'::jsonb)
  into payload from public.assessment_score_events e where e.response_id=p_response_id;
  return jsonb_build_object('ok',true,'events',payload);
end;
$$;

revoke all on function public.exq_request_moderation(uuid,numeric,text) from public,anon;
revoke all on function public.exq_list_moderation_queue() from public,anon;
revoke all on function public.exq_review_moderation(uuid,text,text) from public,anon;
revoke all on function public.exq_get_score_audit(uuid) from public,anon;
grant execute on function public.exq_request_moderation(uuid,numeric,text) to authenticated,service_role;
grant execute on function public.exq_list_moderation_queue() to authenticated,service_role;
grant execute on function public.exq_review_moderation(uuid,text,text) to authenticated,service_role;
grant execute on function public.exq_get_score_audit(uuid) to authenticated,service_role;

commit;
