
-- Canonical structured learner participation; independent of free-text teacher notes.
-- A team/club is a school resource; each learner has a durable, dated membership record.
-- Existing class_groups, duty rosters, leadership and library records remain authoritative.
-- access: service-only public.school_life_activities
-- authorization-test: public.school_life_activities class teacher reads own/school-wide catalog through guarded RPC; anon, subject-only and cross-school denied
-- access: service-only public.school_life_participations
-- authorization-test: public.school_life_participations class teacher can mutate only current enrolled learners; other schools and anonymous users denied
-- access: service-only public.school_life_participation_history
-- authorization-test: public.school_life_participation_history only audited RPC appends; authenticated cannot rewrite history
-- access: service-only public.school_life_mutation_receipts
-- authorization-test: public.school_life_mutation_receipts authenticated cannot directly read or change idempotency receipts
create table if not exists public.school_life_activities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 90),
  category text not null check (category in ('sport','club','arts','event','community','other')),
  details text check (details is null or char_length(details) <= 400),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index if not exists school_life_class_activity_name_unique on public.school_life_activities
  (class_id, lower(btrim(title))) where class_id is not null and archived_at is null;
create unique index if not exists school_life_school_activity_name_unique on public.school_life_activities
  (school_id, lower(btrim(title))) where class_id is null and archived_at is null;
create index if not exists school_life_activities_scope_idx on public.school_life_activities(school_id,class_id) where archived_at is null;

create table if not exists public.school_life_participations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.school_life_activities(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  involvement text not null check (involvement in ('interested','participant','member')),
  position text check (position is null or char_length(position) between 1 and 60),
  note text check (note is null or char_length(note) <= 400),
  started_on date not null default current_date,
  ended_at timestamptz,
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists school_life_one_active_membership on public.school_life_participations(activity_id,student_id)
  where ended_at is null;
create index if not exists school_life_student_view on public.school_life_participations(student_id,ended_at,updated_at desc);
create index if not exists school_life_activity_view on public.school_life_participations(activity_id,ended_at);

-- Immutable, service-only edit history: role changes and exits never erase prior records.
create table if not exists public.school_life_participation_history (
  id bigint generated always as identity primary key,
  participation_id uuid not null references public.school_life_participations(id) on delete restrict,
  action text not null check (action in ('joined','updated','ended')),
  previous_state jsonb,
  next_state jsonb not null,
  actor_id uuid not null references public.profiles(id),
  changed_at timestamptz not null default now()
);
create table if not exists public.school_life_mutation_receipts (
  actor_id uuid not null references public.profiles(id),
  request_id uuid not null,
  payload jsonb not null,
  result_count integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (actor_id,request_id)
);

-- All browser access is via scope-checked, explicitly granted RPCs, not direct table writes.
alter table public.school_life_activities enable row level security;
alter table public.school_life_participations enable row level security;
alter table public.school_life_participation_history enable row level security;
alter table public.school_life_mutation_receipts enable row level security;
revoke all on public.school_life_activities, public.school_life_participations,
  public.school_life_participation_history, public.school_life_mutation_receipts from public, anon, authenticated;
grant all on public.school_life_activities, public.school_life_participations,
  public.school_life_participation_history, public.school_life_mutation_receipts to service_role;

create or replace function public.teacher_school_life_snapshot(p_class_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=public,auth,pg_temp
as $$
declare v_school uuid; v_result jsonb;
begin
  if auth.uid() is null or not public.teacher_can_access_class(p_class_id,null,true) then
    raise exception 'class_teacher_scope_required';
  end if;
  select school_id into v_school from public.classes where id=p_class_id;
  if v_school is null then raise exception 'class_not_found'; end if;
  select jsonb_build_object(
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'category',a.category,
        'details',a.details,'scope',case when a.class_id is null then 'school' else 'class' end)
        order by a.title)
      from public.school_life_activities a
      where a.school_id=v_school and a.archived_at is null
        and (a.class_id is null or a.class_id=p_class_id)
    ),'[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object('id',m.id,'activity_id',m.activity_id,
        'student_id',m.student_id,'involvement',m.involvement,'position',m.position,
        'note',m.note,'started_on',m.started_on) order by m.updated_at desc)
      from public.school_life_participations m
      join public.school_life_activities a on a.id=m.activity_id and a.archived_at is null
      join public.student_classes sc on sc.student_id=m.student_id and sc.school_id=v_school
        and sc.class_id=p_class_id and sc.is_current=true
      where m.school_id=v_school and m.ended_at is null
        and (a.class_id is null or a.class_id=p_class_id)
    ),'[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name)
      from public.student_classes sc
      join public.students s on s.id=sc.student_id and s.deleted_at is null
      where sc.class_id=p_class_id and sc.school_id=v_school and sc.is_current=true
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

-- Class teachers can create/edit class activities only; school-wide catalog entries are admin-managed.
create or replace function public.teacher_save_school_life_activity(
  p_class_id uuid, p_activity_id uuid, p_title text, p_category text, p_details text default null,
  p_scope text default 'class'
) returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare v_school uuid; v_id uuid; v_activity public.school_life_activities%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select school_id into v_school from public.classes where id=p_class_id;
  if v_school is null then raise exception 'class_not_found'; end if;
  if not public.teacher_can_access_class(p_class_id,null,true) and not public.is_school_admin(v_school) then
    raise exception 'class_teacher_scope_required';
  end if;
  if p_scope not in ('class','school') or (p_scope='school' and not public.is_school_admin(v_school)) then
    raise exception 'school_scope_requires_admin';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 2 and 90
    or p_category not in ('sport','club','arts','event','community','other')
    or char_length(coalesce(p_details,''))>400 then
    raise exception 'invalid_activity_details';
  end if;
  if p_activity_id is null then
    insert into public.school_life_activities(school_id,class_id,title,category,details,created_by)
    values(v_school,case when p_scope='school' then null else p_class_id end,
      btrim(p_title),p_category,nullif(btrim(coalesce(p_details,'')),''),auth.uid())
    returning id into v_id;
    return v_id;
  end if;
  select * into v_activity from public.school_life_activities where id=p_activity_id for update;
  if not found or v_activity.school_id<>v_school or v_activity.archived_at is not null then
    raise exception 'activity_not_found';
  end if;
  if v_activity.class_id is null then
    if not public.is_school_admin(v_school) then raise exception 'school_scope_requires_admin'; end if;
  elsif v_activity.class_id<>p_class_id then
    raise exception 'class_scope_mismatch';
  end if;
  if (v_activity.class_id is null and p_scope<>'school') or
     (v_activity.class_id is not null and p_scope<>'class') then
    raise exception 'cannot_change_activity_scope';
  end if;
  update public.school_life_activities
  set title=btrim(p_title),category=p_category,details=nullif(btrim(coalesce(p_details,'')),''),
    updated_at=now() where id=p_activity_id;
  return p_activity_id;
end; $$;

-- Bulk add/edit/end is atomic and idempotent for mobile retries.
create or replace function public.teacher_set_school_life_members(
  p_activity_id uuid, p_student_ids uuid[], p_action text, p_involvement text,
  p_position text, p_note text, p_request_id uuid
) returns integer language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_activity public.school_life_activities%rowtype;
  v_student uuid; v_class uuid; v_existing public.school_life_participations%rowtype;
  v_new public.school_life_participations%rowtype;
  v_payload jsonb; v_count integer:=0; v_is_new boolean; v_receipt_count integer;
  v_position text:=nullif(btrim(coalesce(p_position,'')),'');
  v_note text:=nullif(btrim(coalesce(p_note,'')),'');
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_request_id is null or p_activity_id is null or p_student_ids is null or
    cardinality(p_student_ids) not between 1 and 100 or
    p_action not in ('save','end') or
    (p_action='save' and p_involvement not in ('interested','participant','member'))
    or char_length(coalesce(v_position,''))>60 or char_length(coalesce(v_note,''))>400 then
    raise exception 'invalid_participation_request';
  end if;
  if p_action='save' and p_involvement='interested' and v_position is not null then
    raise exception 'interest_cannot_have_position';
  end if;
  select * into v_activity from public.school_life_activities
    where id=p_activity_id and archived_at is null;
  if not found then raise exception 'activity_not_found'; end if;

  -- Validate every subject before any mutation. A school-wide club is still edited only
  -- for learners in the caller's assigned class, never every student in that school.
  for v_student in select distinct unnest(p_student_ids) loop
    if v_student is null then raise exception 'learner_required'; end if;
    select sc.class_id into v_class
    from public.student_classes sc
    join public.students s on s.id=sc.student_id and s.deleted_at is null
    where sc.student_id=v_student and sc.school_id=v_activity.school_id and sc.is_current=true
      and (v_activity.class_id is null or sc.class_id=v_activity.class_id)
      and (public.teacher_can_access_class(sc.class_id,null,true) or public.is_school_admin(sc.school_id))
    order by sc.class_id limit 1;
    if v_class is null then raise exception 'learner_or_teacher_scope_invalid'; end if;
    v_class:=null;
  end loop;

  v_payload:=jsonb_build_object('activity',p_activity_id,'students',
    (select jsonb_agg(id order by id) from (select distinct unnest(p_student_ids) as id) q),
    'action',p_action,'involvement',case when p_action='end' then null else p_involvement end,
    'position',case when p_action='end' then null else v_position end,
    'note',case when p_action='end' then null else v_note end);
  insert into public.school_life_mutation_receipts(actor_id,request_id,payload)
  values(auth.uid(),p_request_id,v_payload) on conflict do nothing;
  get diagnostics v_receipt_count=row_count;
  v_is_new:=v_receipt_count=1;
  if not v_is_new then
    select result_count into v_count from public.school_life_mutation_receipts
    where actor_id=auth.uid() and request_id=p_request_id and payload=v_payload;
    if not found then raise exception 'request_id_payload_conflict'; end if;
    return v_count;
  end if;

  for v_student in select distinct unnest(p_student_ids) loop
    select * into v_existing from public.school_life_participations
      where activity_id=p_activity_id and student_id=v_student and ended_at is null
      for update;
    if p_action='end' then
      if found then
        update public.school_life_participations set ended_at=now(),updated_at=now(),
          updated_by=auth.uid() where id=v_existing.id returning * into v_new;
        insert into public.school_life_participation_history(
          participation_id,action,previous_state,next_state,actor_id)
        values(v_new.id,'ended',to_jsonb(v_existing),to_jsonb(v_new),auth.uid());
        v_count:=v_count+1;
      end if;
    elsif found then
      if v_existing.involvement is distinct from p_involvement or
         v_existing.position is distinct from v_position or v_existing.note is distinct from v_note then
        update public.school_life_participations set involvement=p_involvement,position=v_position,
          note=v_note,updated_at=now(),updated_by=auth.uid()
        where id=v_existing.id returning * into v_new;
        insert into public.school_life_participation_history(
          participation_id,action,previous_state,next_state,actor_id)
        values(v_new.id,'updated',to_jsonb(v_existing),to_jsonb(v_new),auth.uid());
        v_count:=v_count+1;
      end if;
    else
      insert into public.school_life_participations(activity_id,school_id,student_id,
        involvement,position,note,updated_by)
      values(p_activity_id,v_activity.school_id,v_student,p_involvement,v_position,v_note,auth.uid())
      returning * into v_new;
      insert into public.school_life_participation_history(
        participation_id,action,previous_state,next_state,actor_id)
      values(v_new.id,'joined',null,to_jsonb(v_new),auth.uid());
      v_count:=v_count+1;
    end if;
  end loop;
  update public.school_life_mutation_receipts set result_count=v_count
    where actor_id=auth.uid() and request_id=p_request_id;
  return v_count;
end; $$;

revoke all on function public.teacher_school_life_snapshot(uuid) from public,anon;
revoke all on function public.teacher_save_school_life_activity(uuid,uuid,text,text,text,text) from public,anon;
revoke all on function public.teacher_set_school_life_members(uuid,uuid[],text,text,text,text,uuid) from public,anon;
grant execute on function public.teacher_school_life_snapshot(uuid) to authenticated,service_role;
grant execute on function public.teacher_save_school_life_activity(uuid,uuid,text,text,text,text) to authenticated,service_role;
grant execute on function public.teacher_set_school_life_members(uuid,uuid[],text,text,text,text,uuid) to authenticated,service_role;

