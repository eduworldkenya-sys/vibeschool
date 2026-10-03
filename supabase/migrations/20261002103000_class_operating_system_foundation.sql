-- authorization-test: public.teacher_learner_events
-- authorization-test: public.classroom_games
-- authorization-test: public.classroom_game_teams
-- VibeSchool Class Operating System foundation.
-- Extends the existing canonical class_groups/class_group_members model instead of
-- creating a second roster/list truth. Adds one auditable learner-event ledger
-- for factual teacher observations, participation, recognition and follow-ups.

alter table public.class_groups
  add column if not exists type text not null default 'learning',
  add column if not exists school_id uuid references public.schools(id) on delete cascade,
  add column if not exists created_by uuid references public.profiles(id) on delete restrict,
  add column if not exists subject_id uuid references public.subjects(id) on delete set null,
  add column if not exists mode text not null default 'static',
  add column if not exists purpose text,
  add column if not exists rules jsonb,
  add column if not exists teaching_occurrence_id uuid references public.teaching_occurrences(id) on delete set null,
  add column if not exists expires_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.class_groups g
set school_id = c.school_id
from public.classes c
where c.id = g.class_id
  and g.school_id is null;

alter table public.class_groups drop constraint if exists class_groups_mode_check;
alter table public.class_groups add constraint class_groups_mode_check
  check (mode in ('static','smart','temporary'));

alter table public.class_groups drop constraint if exists class_groups_rules_check;
alter table public.class_groups add constraint class_groups_rules_check
  check (
    (mode <> 'smart' and rules is null)
    or
    (
      mode = 'smart'
      and jsonb_typeof(rules) = 'object'
      and coalesce(rules->>'rule','') in (
        'attendance_below','absence_count_at_least','missing_homework_at_least',
        'assessment_below','no_participation_since'
      )
    )
  );

create index if not exists idx_class_groups_class_active
  on public.class_groups(class_id, archived_at, type, mode);
create index if not exists idx_class_groups_school_teacher
  on public.class_groups(school_id, created_by, archived_at);
create index if not exists idx_class_groups_subject
  on public.class_groups(class_id, subject_id)
  where subject_id is not null and archived_at is null;
create index if not exists idx_class_groups_expiry
  on public.class_groups(expires_at)
  where expires_at is not null and archived_at is null;

create or replace function public.teacher_can_access_class(
  p_class_id uuid,
  p_subject_id uuid default null,
  p_require_class_teacher boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.classes c
    join public.teacher_classes tc
      on tc.class_id = c.id and tc.school_id = c.school_id
    join public.school_members sm
      on sm.school_id = c.school_id
     and sm.profile_id = tc.teacher_id
     and sm.role = 'teacher'
    where c.id = p_class_id
      and tc.teacher_id = auth.uid()
      and (p_subject_id is null or tc.subject_id = p_subject_id)
      and (not p_require_class_teacher or tc.is_class_teacher)
  );
$$;

revoke all on function public.teacher_can_access_class(uuid,uuid,boolean) from public, anon;
grant execute on function public.teacher_can_access_class(uuid,uuid,boolean) to authenticated, service_role;

create or replace function public.class_group_enforce_scope()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_school uuid;
  v_intervention_subject uuid;
begin
  select c.school_id into v_school from public.classes c where c.id = new.class_id;
  if v_school is null then raise exception 'class_not_found'; end if;

  if new.school_id is null then
    new.school_id := v_school;
  elsif new.school_id <> v_school then
    raise exception 'class_school_mismatch';
  end if;

  if auth.uid() is not null then
    if new.created_by is null then
      new.created_by := auth.uid();
    elsif new.created_by <> auth.uid() then
      raise exception 'created_by_mismatch';
    end if;

    if new.subject_id is null and new.type = 'intervention' and new.name like 'Intervention %' then
      select iv.subject_id
      into v_intervention_subject
      from public.assessment_interventions iv
      where iv.class_id = new.class_id
        and iv.school_id = v_school
        and iv.teacher_id = auth.uid()
        and ('Intervention ' || left(iv.id::text, 8)) = new.name
      order by iv.created_at desc
      limit 1;
      new.subject_id := v_intervention_subject;
    end if;

    if (
      (new.subject_id is null and not public.teacher_can_access_class(new.class_id, null, true))
      or
      (new.subject_id is not null and not public.teacher_can_access_class(new.class_id, new.subject_id, false))
    ) then
      raise exception 'teacher_scope_not_authorized';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_class_group_enforce_scope on public.class_groups;
create trigger trg_class_group_enforce_scope
before insert or update on public.class_groups
for each row execute function public.class_group_enforce_scope();

drop policy if exists "Teachers manage their class groups" on public.class_groups;
create policy "Teachers manage their class groups"
on public.class_groups for all to authenticated
using (
  (subject_id is null and public.teacher_can_access_class(class_id, null, true))
  or
  (subject_id is not null and public.teacher_can_access_class(class_id, subject_id, false))
)
with check (
  (subject_id is null and public.teacher_can_access_class(class_id, null, true))
  or
  (subject_id is not null and public.teacher_can_access_class(class_id, subject_id, false))
);

drop policy if exists "Teachers manage group members" on public.class_group_members;
create policy "Teachers manage group members"
on public.class_group_members for all to authenticated
using (
  exists (
    select 1
    from public.class_groups g
    join public.student_classes sc
      on sc.student_id = class_group_members.student_id
     and sc.class_id = g.class_id
     and sc.school_id = g.school_id
     and sc.is_current = true
    where g.id = class_group_members.group_id
      and (
        (g.subject_id is null and public.teacher_can_access_class(g.class_id, null, true))
        or
        (g.subject_id is not null and public.teacher_can_access_class(g.class_id, g.subject_id, false))
      )
  )
)
with check (
  exists (
    select 1
    from public.class_groups g
    join public.student_classes sc
      on sc.student_id = class_group_members.student_id
     and sc.class_id = g.class_id
     and sc.school_id = g.school_id
     and sc.is_current = true
    where g.id = class_group_members.group_id
      and (
        (g.subject_id is null and public.teacher_can_access_class(g.class_id, null, true))
        or
        (g.subject_id is not null and public.teacher_can_access_class(g.class_id, g.subject_id, false))
      )
  )
);

create table if not exists public.teacher_learner_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teaching_occurrence_id uuid references public.teaching_occurrences(id) on delete set null,
  event_kind text not null check (event_kind in (
    'observation','participation','recognition','followup','parent_contact','management'
  )),
  event_code text,
  note text,
  visibility text not null default 'author' check (visibility in (
    'author','subject_team','class_teacher','school'
  )),
  metadata jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  resolved_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint teacher_learner_events_note_or_code
    check (nullif(trim(coalesce(note,'')),'') is not null or nullif(trim(coalesce(event_code,'')),'') is not null)
);

create index if not exists idx_teacher_learner_events_student_timeline
  on public.teacher_learner_events(student_id, created_at desc)
  where archived_at is null;
create index if not exists idx_teacher_learner_events_class_kind
  on public.teacher_learner_events(class_id, event_kind, created_at desc)
  where archived_at is null;
create index if not exists idx_teacher_learner_events_due
  on public.teacher_learner_events(class_id, due_at)
  where due_at is not null and resolved_at is null and archived_at is null;
create index if not exists idx_teacher_learner_events_subject
  on public.teacher_learner_events(class_id, subject_id, created_at desc)
  where subject_id is not null and archived_at is null;

alter table public.teacher_learner_events enable row level security;
revoke all privileges on table public.teacher_learner_events from anon, authenticated;
grant select, insert, update, delete on table public.teacher_learner_events to authenticated;
grant all privileges on table public.teacher_learner_events to service_role;

create or replace function public.teacher_learner_event_enforce_scope()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_school uuid;
begin
  select c.school_id into v_school from public.classes c where c.id = new.class_id;
  if v_school is null or v_school <> new.school_id then raise exception 'class_school_mismatch'; end if;

  if not exists (
    select 1 from public.student_classes sc
    where sc.student_id = new.student_id
      and sc.class_id = new.class_id
      and sc.school_id = new.school_id
      and sc.is_current = true
  ) then
    raise exception 'learner_not_in_class';
  end if;

  if auth.uid() is not null then
    if new.created_by <> auth.uid() then raise exception 'created_by_mismatch'; end if;
    if (
      (new.subject_id is null and not public.teacher_can_access_class(new.class_id, null, true))
      or
      (new.subject_id is not null and not public.teacher_can_access_class(new.class_id, new.subject_id, false))
    ) then
      raise exception 'teacher_scope_not_authorized';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_teacher_learner_event_scope on public.teacher_learner_events;
create trigger trg_teacher_learner_event_scope
before insert or update on public.teacher_learner_events
for each row execute function public.teacher_learner_event_enforce_scope();

drop policy if exists "Teacher learner events read" on public.teacher_learner_events;
create policy "Teacher learner events read"
on public.teacher_learner_events for select to authenticated
using (
  (created_by = auth.uid() and public.teacher_can_access_class(class_id, null, false))
  or (visibility = 'school' and public.teacher_can_access_class(class_id, null, false))
  or (
    visibility = 'subject_team'
    and subject_id is not null
    and (
      public.teacher_can_access_class(class_id, subject_id, false)
      or public.teacher_can_access_class(class_id, null, true)
    )
  )
  or (visibility = 'class_teacher' and public.teacher_can_access_class(class_id, null, true))
);

drop policy if exists "Teacher learner events insert" on public.teacher_learner_events;
create policy "Teacher learner events insert"
on public.teacher_learner_events for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    (subject_id is null and public.teacher_can_access_class(class_id, null, true))
    or
    (subject_id is not null and public.teacher_can_access_class(class_id, subject_id, false))
  )
);

drop policy if exists "Teacher learner events update own" on public.teacher_learner_events;
create policy "Teacher learner events update own"
on public.teacher_learner_events for update to authenticated
using (
  created_by = auth.uid()
  and (
    (subject_id is null and public.teacher_can_access_class(class_id, null, true))
    or
    (subject_id is not null and public.teacher_can_access_class(class_id, subject_id, false))
  )
)
with check (
  created_by = auth.uid()
  and (
    (subject_id is null and public.teacher_can_access_class(class_id, null, true))
    or
    (subject_id is not null and public.teacher_can_access_class(class_id, subject_id, false))
  )
);

drop policy if exists "Teacher learner events delete own" on public.teacher_learner_events;
create policy "Teacher learner events delete own"
on public.teacher_learner_events for delete to authenticated
using (
  created_by = auth.uid()
  and (
    (subject_id is null and public.teacher_can_access_class(class_id, null, true))
    or
    (subject_id is not null and public.teacher_can_access_class(class_id, subject_id, false))
  )
);

create or replace function public.teacher_resolve_class_group_members(p_group_id uuid)
returns table(student_id uuid, reason text)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  g public.class_groups%rowtype;
  v_rule text;
  v_threshold numeric;
  v_count integer;
  v_since timestamptz;
begin
  select * into g from public.class_groups where id = p_group_id and archived_at is null;
  if not found then raise exception 'group_not_found'; end if;
  if (
    (g.subject_id is null and not public.teacher_can_access_class(g.class_id, null, true))
    or
    (g.subject_id is not null and not public.teacher_can_access_class(g.class_id, g.subject_id, false))
  ) then
    raise exception 'teacher_scope_not_authorized';
  end if;

  if g.mode <> 'smart' then
    return query
      select m.student_id, 'saved member'::text
      from public.class_group_members m
      join public.student_classes sc
        on sc.student_id = m.student_id
       and sc.class_id = g.class_id
       and sc.school_id = g.school_id
       and sc.is_current = true
      where m.group_id = g.id;
    return;
  end if;

  v_rule := g.rules->>'rule';

  if v_rule = 'attendance_below' then
    v_threshold := greatest(0, least(100, coalesce((g.rules->>'threshold')::numeric, 80)));
    return query
      with roster as (
        select sc.student_id from public.student_classes sc
        where sc.class_id=g.class_id and sc.school_id=g.school_id and sc.is_current=true
      ), agg as (
        select r.student_id, count(a.id) as total,
          count(a.id) filter (where a.status='present') as present
        from roster r
        left join public.attendance a
          on a.student_id=r.student_id and a.class_id=g.class_id and a.school_id=g.school_id
        group by r.student_id
      )
      select a.student_id,
        'Attendance ' || round(100.0*a.present/nullif(a.total,0))::text || '% is below ' || round(v_threshold)::text || '%'
      from agg a
      where a.total > 0 and (100.0*a.present/nullif(a.total,0)) < v_threshold;
    return;
  end if;

  if v_rule = 'absence_count_at_least' then
    v_count := greatest(1, least(50, coalesce((g.rules->>'count')::integer, 3)));
    return query
      select sc.student_id, format('%s recorded absences', count(a.id))
      from public.student_classes sc
      join public.attendance a
        on a.student_id=sc.student_id and a.class_id=g.class_id
       and a.school_id=g.school_id and a.status='absent'
      where sc.class_id=g.class_id and sc.school_id=g.school_id and sc.is_current=true
      group by sc.student_id
      having count(a.id) >= v_count;
    return;
  end if;

  if v_rule = 'missing_homework_at_least' then
    v_count := greatest(1, least(20, coalesce((g.rules->>'count')::integer, 2)));
    return query
      with roster as (
        select sc.student_id from public.student_classes sc
        where sc.class_id=g.class_id and sc.school_id=g.school_id and sc.is_current=true
      ), missing as (
        select r.student_id, count(h.id)::int as missing_count
        from roster r
        join public.homework h
          on h.class_id=g.class_id and h.school_id=g.school_id
         and h.teacher_id=auth.uid()
         and h.due_date is not null and h.due_date < current_date
        left join public.homework_submissions hs
          on hs.homework_id=h.id and hs.student_id=r.student_id
        where hs.id is null
        group by r.student_id
      )
      select m.student_id, format('%s overdue tasks have no submission', m.missing_count)
      from missing m where m.missing_count >= v_count;
    return;
  end if;

  if v_rule = 'assessment_below' then
    v_threshold := greatest(0, least(100, coalesce((g.rules->>'threshold')::numeric, 50)));
    return query
      select distinct on (e.student_id)
        e.student_id,
        'Latest released score ' || round(e.percentage)::text || '% is below ' || round(v_threshold)::text || '%'
      from public.assessment_gradebook_entries e
      join public.student_classes sc
        on sc.student_id=e.student_id and sc.class_id=g.class_id
       and sc.school_id=g.school_id and sc.is_current=true
      where e.class_id=g.class_id
        and e.school_id=g.school_id
        and e.teacher_id=auth.uid()
        and e.percentage is not null
        and (g.subject_id is null or e.subject_id=g.subject_id)
        and e.percentage < v_threshold
      order by e.student_id, e.released_at desc nulls last;
    return;
  end if;

  if v_rule = 'no_participation_since' then
    v_since := coalesce((g.rules->>'since')::timestamptz, now() - interval '7 days');
    return query
      select sc.student_id, format('No recorded participation since %s', v_since::date)
      from public.student_classes sc
      where sc.class_id=g.class_id and sc.school_id=g.school_id and sc.is_current=true
        and not exists (
          select 1 from public.teacher_learner_events e
          where e.student_id=sc.student_id
            and e.class_id=g.class_id
            and e.school_id=g.school_id
            and e.event_kind='participation'
            and e.created_at >= v_since
            and e.archived_at is null
            and (g.subject_id is null or e.subject_id=g.subject_id)
        );
    return;
  end if;

  raise exception 'unsupported_smart_rule';
end;
$$;

revoke all on function public.teacher_resolve_class_group_members(uuid) from public, anon;
grant execute on function public.teacher_resolve_class_group_members(uuid) to authenticated, service_role;


-- Optional admission numbers remain safe because the client supplies a stable
-- request UUID for the duration of the create operation. Retrying the same
-- request returns the same learner; admission-number conflicts still fail closed.
create or replace function public.teacher_add_student_v2(
  p_name text,
  p_admission_number text default null,
  p_class_id uuid default null,
  p_school_id uuid default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_student_id uuid;
  v_uid uuid := auth.uid();
  v_role text;
  v_admission text := nullif(lower(trim(p_admission_number)), '');
  v_payload_hash text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_school_id is null then raise exception 'school_required'; end if;
  if p_request_id is null then raise exception 'request_id_required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'student_name_required'; end if;

  select sm.role::text into v_role
  from public.school_members sm
  where sm.school_id=p_school_id
    and sm.profile_id=v_uid
    and sm.role::text in ('teacher','admin','owner')
  limit 1;
  if v_role is null then raise exception 'not_authorized'; end if;

  if p_class_id is not null then
    if not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=p_school_id) then
      raise exception 'class_school_mismatch';
    end if;
    if v_role='teacher' and not exists(
      select 1 from public.teacher_classes tc
      where tc.teacher_id=v_uid and tc.school_id=p_school_id and tc.class_id=p_class_id and tc.is_class_teacher=true
    ) then
      raise exception 'teacher_not_assigned_to_class';
    end if;
  end if;

  v_payload_hash := md5(jsonb_build_object(
    'request_id',p_request_id,'school_id',p_school_id,'class_id',p_class_id,
    'name',trim(p_name),'admission',v_admission
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(
    v_uid::text || ':teacher_add_student_v2:' || p_request_id::text, 0
  ));

  select r.student_id into v_student_id
  from public.student_provisioning_receipts r
  where r.actor_id=v_uid
    and r.operation='teacher_add_student'
    and r.payload_hash=v_payload_hash;
  if v_student_id is not null then return v_student_id; end if;

  if v_admission is not null and exists (
    select 1
    from public.students existing
    join public.student_classes sc
      on sc.student_id=existing.id and sc.is_current=true
    where sc.school_id=p_school_id
      and existing.deleted_at is null
      and lower(trim(existing.admission_number))=v_admission
  ) then
    raise exception 'admission_identifier_conflict';
  end if;

  insert into public.students(name,admission_number,class_id,created_by)
  values(trim(p_name),nullif(trim(p_admission_number),''),p_class_id,v_uid)
  returning id into v_student_id;

  if p_class_id is not null then
    insert into public.student_classes(student_id,class_id,school_id,is_current,joined_at)
    values(v_student_id,p_class_id,p_school_id,true,now());
  end if;

  insert into public.student_claim_codes(student_id,code,claimed,role)
  values(v_student_id,upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),false,'both');

  insert into public.student_provisioning_receipts(actor_id,operation,payload_hash,student_id)
  values(v_uid,'teacher_add_student',v_payload_hash,v_student_id);

  return v_student_id;
end;
$function$;

revoke all on function public.teacher_add_student_v2(text,text,uuid,uuid,uuid) from public, anon;
grant execute on function public.teacher_add_student_v2(text,text,uuid,uuid,uuid) to authenticated, service_role;


-- Assignment systems such as homework currently authorize targeted learners
-- through saved class_group_members. Snapshot a dynamic list before assigning so
-- historical eligibility does not drift when the smart rule later changes.
create or replace function public.teacher_snapshot_class_group(
  p_group_id uuid,
  p_purpose text default 'assignment snapshot'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  source public.class_groups%rowtype;
  snapshot_id uuid;
begin
  select * into source
  from public.class_groups
  where id=p_group_id and archived_at is null;

  if source.id is null then raise exception 'group_not_found'; end if;
  if (
    (source.subject_id is null and not public.teacher_can_access_class(source.class_id, null, true))
    or
    (source.subject_id is not null and not public.teacher_can_access_class(source.class_id, source.subject_id, false))
  ) then
    raise exception 'teacher_scope_not_authorized';
  end if;

  if source.mode <> 'smart' then
    return source.id;
  end if;

  insert into public.class_groups(
    class_id,school_id,created_by,subject_id,name,color,type,mode,purpose,expires_at
  ) values(
    source.class_id,source.school_id,auth.uid(),source.subject_id,
    source.name || ' · assignment',source.color,source.type,'temporary',
    nullif(trim(p_purpose),''),now()+interval '90 days'
  )
  returning id into snapshot_id;

  insert into public.class_group_members(group_id,student_id)
  select snapshot_id,resolved.student_id
  from public.teacher_resolve_class_group_members(source.id) resolved
  on conflict(group_id,student_id) do nothing;

  return snapshot_id;
end;
$function$;

revoke all on function public.teacher_snapshot_class_group(uuid,text) from public, anon;
grant execute on function public.teacher_snapshot_class_group(uuid,text) to authenticated, service_role;


create table if not exists public.classroom_games (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  teaching_occurrence_id uuid references public.teaching_occurrences(id) on delete set null,
  title text not null,
  status text not null default 'active' check (status in ('active','finished','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classroom_game_teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.classroom_games(id) on delete cascade,
  group_id uuid not null references public.class_groups(id) on delete restrict,
  label text not null,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(game_id,group_id)
);

create index if not exists idx_classroom_games_class_active
  on public.classroom_games(class_id,status,created_at desc);
create index if not exists idx_classroom_game_teams_game
  on public.classroom_game_teams(game_id,score desc);

alter table public.classroom_games enable row level security;
alter table public.classroom_game_teams enable row level security;
grant select,insert,update,delete on public.classroom_games,public.classroom_game_teams to authenticated;
grant all on public.classroom_games,public.classroom_game_teams to service_role;

create or replace function public.classroom_game_enforce_scope()
returns trigger
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $function$
declare v_school uuid;
begin
  select school_id into v_school from public.classes where id=new.class_id;
  if v_school is null or v_school<>new.school_id then raise exception 'class_school_mismatch'; end if;
  if auth.uid() is not null then
    if new.teacher_id<>auth.uid() then raise exception 'teacher_id_mismatch'; end if;
    if (
      (new.subject_id is null and not public.teacher_can_access_class(new.class_id,null,true))
      or
      (new.subject_id is not null and not public.teacher_can_access_class(new.class_id,new.subject_id,false))
    ) then raise exception 'teacher_scope_not_authorized'; end if;
  end if;
  new.updated_at:=now();
  return new;
end;
$function$;

drop trigger if exists trg_classroom_game_scope on public.classroom_games;
create trigger trg_classroom_game_scope
before insert or update on public.classroom_games
for each row execute function public.classroom_game_enforce_scope();

drop policy if exists "Teachers manage classroom games" on public.classroom_games;
create policy "Teachers manage classroom games"
on public.classroom_games for all to authenticated
using (
  teacher_id=auth.uid()
  and (
    (subject_id is null and public.teacher_can_access_class(class_id,null,true))
    or
    (subject_id is not null and public.teacher_can_access_class(class_id,subject_id,false))
  )
)
with check (
  teacher_id=auth.uid()
  and (
    (subject_id is null and public.teacher_can_access_class(class_id,null,true))
    or
    (subject_id is not null and public.teacher_can_access_class(class_id,subject_id,false))
  )
);

drop policy if exists "Teachers manage classroom game teams" on public.classroom_game_teams;
create policy "Teachers manage classroom game teams"
on public.classroom_game_teams for all to authenticated
using (
  exists(
    select 1 from public.classroom_games game
    where game.id=classroom_game_teams.game_id
      and game.teacher_id=auth.uid()
      and (
        (game.subject_id is null and public.teacher_can_access_class(game.class_id,null,true))
        or
        (game.subject_id is not null and public.teacher_can_access_class(game.class_id,game.subject_id,false))
      )
  )
)
with check (
  exists(
    select 1
    from public.classroom_games game
    join public.class_groups grp
      on grp.id=classroom_game_teams.group_id
     and grp.class_id=game.class_id
     and grp.school_id=game.school_id
    where game.id=classroom_game_teams.game_id
      and game.teacher_id=auth.uid()
      and (
        (game.subject_id is null and public.teacher_can_access_class(game.class_id,null,true))
        or
        (game.subject_id is not null and public.teacher_can_access_class(game.class_id,game.subject_id,false))
      )
  )
);

create or replace function public.teacher_adjust_game_score(
  p_team_id uuid,
  p_delta integer
)
returns integer
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $function$
declare next_score integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_delta is null or p_delta < -100 or p_delta > 100 then raise exception 'invalid_score_delta'; end if;

  update public.classroom_game_teams team
  set score=greatest(0,team.score+p_delta),updated_at=now()
  from public.classroom_games game
  where team.id=p_team_id
    and game.id=team.game_id
    and game.status='active'
    and game.teacher_id=auth.uid()
    and (
      (game.subject_id is null and public.teacher_can_access_class(game.class_id,null,true))
      or
      (game.subject_id is not null and public.teacher_can_access_class(game.class_id,game.subject_id,false))
    )
  returning team.score into next_score;

  if next_score is null then raise exception 'game_team_not_authorized'; end if;
  return next_score;
end;
$function$;

revoke all on function public.teacher_adjust_game_score(uuid,integer) from public,anon;
grant execute on function public.teacher_adjust_game_score(uuid,integer) to authenticated,service_role;
