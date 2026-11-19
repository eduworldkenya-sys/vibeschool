-- Bounded live-classroom pilot: transient formative interactions, not formal grades.
-- access: authenticated RPC only; private storage and per-action membership validation.
begin;
create schema vibe_live;
revoke all on schema vibe_live from public, anon, authenticated;
grant usage on schema vibe_live to authenticated;

-- access: service-only vibe_live.sessions
-- authorization-test: vibe_live.sessions denies direct client access; scoped RPC tested in scripts/test-live-classroom-pilot.mjs.
create table vibe_live.sessions (
 id uuid primary key default gen_random_uuid(),
 class_id uuid references public.classes(id) on delete restrict,
 school_id uuid,
 mode text not null default 'school' check(mode in ('school','tuition','homeschool','open')),
 group_id uuid references public.vibetutor_private_groups(id) on delete restrict,
 check ((mode='school' and class_id is not null and school_id is not null and group_id is null) or (mode<>'school' and class_id is null and school_id is null and (mode='tuition' or group_id is null))),
 teacher_id uuid not null references public.profiles(id) on delete restrict,
 title text not null check (char_length(title) between 1 and 120),
 status text not null default 'active' check(status in ('active','paused','ended')),
 version integer not null default 0,
 current_prompt uuid,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '2 hours')
);
create unique index live_one_session_per_teacher_class on vibe_live.sessions(class_id,teacher_id) where mode='school' and status in ('active','paused');
create unique index live_one_personal_session on vibe_live.sessions(teacher_id) where mode<>'school' and status in ('active','paused');
create index live_class_session_lookup on vibe_live.sessions(class_id,created_at desc);
-- access: service-only vibe_live.prompts
-- authorization-test: vibe_live.prompts denies direct client access; scoped RPC tested in scripts/test-live-classroom-pilot.mjs.
create table vibe_live.prompts (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references vibe_live.sessions(id) on delete restrict,
 kind text not null check(kind in ('teach','quiz','exercise','poll','clock','board')),
 body text not null check(char_length(body) between 1 and 4000),
 answer_key text check(char_length(answer_key)<=2000),
 revealed boolean not null default false,
 created_at timestamptz not null default now()
);
-- access: service-only vibe_live.participants
-- authorization-test: vibe_live.participants denies direct client access; scoped RPC tested in scripts/test-live-classroom-pilot.mjs.
create table vibe_live.participants (
 session_id uuid not null references vibe_live.sessions(id) on delete restrict,
 student_id uuid not null references public.students(id) on delete restrict,
 joined_at timestamptz not null default now(),
 needs_help boolean not null default false,
 primary key(session_id,student_id)
);
-- access: service-only vibe_live.responses
-- authorization-test: vibe_live.responses denies direct client access; scoped RPC tested in scripts/test-live-classroom-pilot.mjs.
create table vibe_live.responses (
 prompt_id uuid not null references vibe_live.prompts(id) on delete restrict,
 student_id uuid not null references public.students(id) on delete restrict,
 body text not null check(char_length(body) between 1 and 2000),
 submitted_at timestamptz not null default now(),
 primary key(prompt_id,student_id)
);
alter table vibe_live.sessions enable row level security;
alter table vibe_live.prompts enable row level security;
alter table vibe_live.participants enable row level security;
alter table vibe_live.responses enable row level security;
revoke all on table vibe_live.sessions from public,anon,authenticated;
revoke all on table vibe_live.prompts from public,anon,authenticated;
revoke all on table vibe_live.participants from public,anon,authenticated;
revoke all on table vibe_live.responses from public,anon,authenticated;

-- Resolve current eligibility from the existing identity, school and consent-backed tuition records.
create function vibe_live.school_level(p_label text) returns boolean language sql immutable set search_path='' as $$
 select lower(btrim(coalesce(p_label,''))) ~ '^(pp[12]|grade ([1-9]|1[012])|form [1-4])$';
$$;
create function vibe_live.eligible_student(p_student uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from public.students s join public.profiles p on p.id=s.profile_id
  where s.id=p_student and s.deleted_at is null and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
  and (
   exists(select 1 from public.student_classes sc join public.classes c on c.id=sc.class_id where sc.student_id=s.id and sc.is_current and c.school_id=sc.school_id and vibe_live.school_level(c.name))
   or (not exists(select 1 from public.student_classes sc where sc.student_id=s.id and sc.is_current)
     and exists(select 1 from public.independent_learner_identities i where i.user_id=s.profile_id and i.account_state in ('restricted','eligible') and i.learner_email_verified_at is not null and vibe_live.school_level(i.grade_label)))
  )
 );
$$;
create function vibe_live.host_allowed(p_host uuid,p_mode text,p_class uuid,p_school uuid,p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_host and p.account_status::text='active' and not coalesce(p.is_anonymized,false) and (
  (p_mode='school' and p.role::text='teacher' and exists(select 1 from public.teacher_classes tc join public.school_members sm on sm.school_id=tc.school_id and sm.profile_id=tc.teacher_id and sm.role::text='teacher' join public.classes c on c.id=tc.class_id and c.school_id=tc.school_id where tc.teacher_id=p_host and tc.class_id=p_class and tc.school_id=p_school and vibe_live.school_level(c.name)))
  or (p_mode='tuition' and p.role::text='teacher' and (p_group is null or exists(select 1 from public.vibetutor_private_groups g where g.id=p_group and g.tutor_id=p_host)) and exists(select 1 from public.vibetutor_student_invitations i where i.tutor_id=p_host and i.status='accepted' and vibe_live.eligible_student(i.student_id) and (p_group is null or exists(select 1 from public.vibetutor_private_group_members gm where gm.group_id=p_group and gm.invitation_id=i.id))))
  or (p_mode='homeschool' and exists(select 1 from public.parent_student_links l where l.parent_id=p_host and vibe_live.eligible_student(l.student_id)))
  or (p_mode='open' and p.role::text='teacher' and exists(select 1 from public.vibetutor_tutors t where t.profile_id=p_host and t.status='published'))
 ));
$$;
create function vibe_live.can_join(p_student uuid,p_host uuid,p_mode text,p_class uuid,p_school uuid,p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select vibe_live.eligible_student(p_student) and vibe_live.host_allowed(p_host,p_mode,p_class,p_school,p_group) and (
  (p_mode='school' and exists(select 1 from public.student_classes sc where sc.student_id=p_student and sc.class_id=p_class and sc.school_id=p_school and sc.is_current))
  or (p_mode in ('tuition','open') and exists(select 1 from public.vibetutor_student_invitations i where i.student_id=p_student and i.tutor_id=p_host and i.status='accepted' and (p_group is null or exists(select 1 from public.vibetutor_private_group_members gm where gm.group_id=p_group and gm.invitation_id=i.id))))
  or (p_mode='homeschool' and exists(select 1 from public.parent_student_links l where l.parent_id=p_host and l.student_id=p_student))
 );
$$;
revoke all on function vibe_live.school_level(text),vibe_live.eligible_student(uuid),vibe_live.host_allowed(uuid,text,uuid,uuid,uuid),vibe_live.can_join(uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated;

-- The single RPC resolves the actor from auth.uid(), never client-supplied identity.
create function vibe_live.command(p_action text,p_class_id uuid,p_session_id uuid,p_version integer,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 caller uuid := auth.uid();
 school uuid; learner uuid; learner_count integer;
 can_teach boolean := false; is_teacher boolean := false;
 room vibe_live.sessions%rowtype; prompt vibe_live.prompts%rowtype;
 kind text; body text; key_text text; target uuid; result jsonb;
 session_mode text; target_group uuid; hosting boolean;
begin
 if caller is null or not exists (
   select 1 from public.profiles p where p.id=caller and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
 ) then raise exception 'live_not_authorized' using errcode='42501'; end if;
 if p_action is null or p_action not in ('list','groups','start','get','join','publish','pause','resume','reveal','end','answer','help','ack')
 or p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>28000 then
   raise exception 'live_invalid_request' using errcode='22023';
 end if;
 hosting:=coalesce(p_payload->>'host','false')='true' or p_action in ('start','publish','pause','resume','reveal','end','ack','groups');
 if p_class_id is not null then
  select c.school_id into school from public.classes c where c.id=p_class_id and vibe_live.school_level(c.name);
  if school is null then raise exception 'live_not_authorized' using errcode='42501'; end if;
  can_teach := coalesce(public.teacher_can_access_class(p_class_id,null,false),false)
   and coalesce((public.teacher_get_operating_context(null)->>'school_id')=school::text,false);
 end if;
 select count(*), min(s.id::text)::uuid into learner_count,learner
 from public.students s where s.profile_id=caller and vibe_live.eligible_student(s.id);
 if learner_count<>1 then learner:=null; end if;
 if p_action='groups' then
  if not exists(select 1 from public.profiles p where p.id=caller and p.role::text='teacher') then raise exception 'live_not_authorized' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'title',g.title) order by g.title) from public.vibetutor_private_groups g where g.tutor_id=caller),'[]'::jsonb);
 end if;
 if p_action='list' then
   -- Host discovery never returns any other host's private rooms. Learners see
   -- eligible rooms across all scopes, plus public titles for approved open sessions.
   if not hosting and learner is null then raise exception 'live_not_authorized' using errcode='42501'; end if;
   return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'status',x.status,'own',x.teacher_id=caller,'mode',x.mode,'canJoin',vibe_live.can_join(learner,x.teacher_id,x.mode,x.class_id,x.school_id,x.group_id)) order by x.created_at desc)
   from (select r.* from vibe_live.sessions r where (p_class_id is null or r.class_id=p_class_id) and r.status in ('active','paused') and r.expires_at>now()
   and vibe_live.host_allowed(r.teacher_id,r.mode,r.class_id,r.school_id,r.group_id)
   and (case when hosting then r.teacher_id=caller and (r.mode<>'school' or (r.class_id=p_class_id and can_teach))
             else r.teacher_id<>caller and (vibe_live.can_join(learner,r.teacher_id,r.mode,r.class_id,r.school_id,r.group_id) or r.mode='open') end)
   order by r.created_at desc,r.id limit 30) x),'[]'::jsonb);
 end if;
 if p_action='start' then
   session_mode:=case when p_class_id is not null then 'school' else p_payload->>'mode' end;
   if session_mode is null or session_mode not in ('school','tuition','homeschool','open') then raise exception 'live_invalid_mode'; end if;
   target_group:=nullif(p_payload->>'groupId','')::uuid;
   if (session_mode<>'tuition' and target_group is not null) or (session_mode='school' and not can_teach)
    or not vibe_live.host_allowed(caller,session_mode,p_class_id,school,target_group) then raise exception 'live_teacher_required' using errcode='42501'; end if;
   body:=btrim(coalesce(p_payload->>'title',''));
   if char_length(body) not between 1 and 120 then raise exception 'live_title_required'; end if;
   perform 1 from public.profiles where id=caller for update;
   update vibe_live.sessions set status='ended',version=version+1 where teacher_id=caller and class_id is not distinct from p_class_id and status in ('active','paused') and expires_at<=now();
   select * into room from vibe_live.sessions where teacher_id=caller and class_id is not distinct from p_class_id and status in ('active','paused');
   if found then
    if room.mode<>session_mode or room.group_id is distinct from target_group then raise exception 'live_end_previous_session'; end if;
   else
     if exists(select 1 from vibe_live.sessions where teacher_id=caller and class_id is not distinct from p_class_id and created_at>now()-interval '10 seconds') then raise exception 'live_try_again'; end if;
     insert into vibe_live.sessions(class_id,school_id,teacher_id,title,mode,group_id) values(p_class_id,school,caller,body,session_mode,target_group) returning * into room;
   end if;
 else
   if p_action='get' then
     select * into room from vibe_live.sessions where id=p_session_id and (p_class_id is null or class_id=p_class_id) for share;
   else
     select * into room from vibe_live.sessions where id=p_session_id and (p_class_id is null or class_id=p_class_id) for update;
   end if;
   if not found then raise exception 'live_not_authorized' using errcode='42501'; end if;
 end if;
 -- Permissions follow the stored room, never a client-provided classroom type.
 is_teacher:=room.teacher_id=caller and vibe_live.host_allowed(caller,room.mode,room.class_id,room.school_id,room.group_id)
  and (room.mode<>'school' or (room.class_id=p_class_id and can_teach));
 if not is_teacher and not vibe_live.can_join(learner,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id) then raise exception 'live_not_authorized' using errcode='42501'; end if;
 if p_action in ('publish','pause','resume','reveal','end','ack') and not is_teacher then
   raise exception 'live_teacher_required' using errcode='42501';
 end if;
 if p_action in ('join','answer','help') and (learner is null or is_teacher) then
   raise exception 'live_learner_required' using errcode='42501';
 end if;
 if p_action not in ('get','start') and (room.status='ended' or room.expires_at<=now()) then raise exception 'live_session_closed'; end if;
 if p_action in ('publish','pause','resume','reveal','end') and p_version is distinct from room.version then
   raise exception 'live_stale_version';
 end if;
 if p_action='join' then
   insert into vibe_live.participants(session_id,student_id) values(room.id,learner) on conflict do nothing;
 elsif not is_teacher and not exists(select 1 from vibe_live.participants where session_id=room.id and student_id=learner) then
   raise exception 'live_join_required' using errcode='42501';
 end if;
 if p_action='publish' then
   if room.status<>'active' then raise exception 'live_paused'; end if;
   kind:=p_payload->>'kind'; body:=btrim(coalesce(p_payload->>'body','')); key_text:=nullif(btrim(coalesce(p_payload->>'answerKey','')),'');
   if kind is null or kind not in ('teach','quiz','exercise','poll','clock','board') or char_length(body) not between 1 and 4000 or char_length(coalesce(key_text,''))>2000
    or (kind in ('teach','poll','clock','board') and key_text is not null) then raise exception 'live_invalid_prompt'; end if;
   if kind='clock' and body !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'live_invalid_clock'; end if;
   if kind='board' and (body !~ '^[0-9,;| ]+$' or char_length(body)>3500) then raise exception 'live_invalid_board'; end if;
   if (select count(*) from vibe_live.prompts where session_id=room.id)>=100 then raise exception 'live_prompt_limit'; end if;
   insert into vibe_live.prompts(session_id,kind,body,answer_key) values(room.id,kind,body,key_text) returning * into prompt;
   update vibe_live.sessions set current_prompt=prompt.id,version=version+1 where id=room.id returning * into room;
 elsif p_action in ('pause','resume','end') then
   update vibe_live.sessions set status=case p_action when 'pause' then 'paused' when 'resume' then 'active' else 'ended' end,version=version+1 where id=room.id returning * into room;
 elsif p_action='reveal' then
   if room.current_prompt is null then raise exception 'live_no_prompt'; end if;
   update vibe_live.prompts q set revealed=true where q.id=room.current_prompt and q.kind in ('quiz','exercise','poll');
   if not found then raise exception 'live_no_question'; end if;
   update vibe_live.sessions set version=version+1 where id=room.id returning * into room;
 elsif p_action='answer' then
   if room.status<>'active' or p_version is distinct from room.version then raise exception 'live_stale_or_paused'; end if;
   select * into prompt from vibe_live.prompts where id=room.current_prompt;
   body:=btrim(coalesce(p_payload->>'body',''));
   if not found or prompt.kind not in ('quiz','exercise','poll') or prompt.revealed or char_length(body) not between 1 and 2000
     or p_payload->>'promptId' is distinct from prompt.id::text then raise exception 'live_answer_not_open'; end if;
   insert into vibe_live.responses(prompt_id,student_id,body) values(prompt.id,learner,body) on conflict do nothing;
 elsif p_action='help' then
   update vibe_live.participants set needs_help=true where session_id=room.id and student_id=learner;
 elsif p_action='ack' then
   target := (p_payload->>'studentId')::uuid;
   update vibe_live.participants set needs_help=false where session_id=room.id and student_id=target;
 end if;

 select * into prompt from vibe_live.prompts where id=room.current_prompt;
 result:=jsonb_build_object('id',room.id,'title',room.title,'version',room.version,'status',
   case when room.expires_at<=now() then 'ended' else room.status end,
   'teacher',is_teacher,'mode',room.mode,'expiresAt',room.expires_at,'prompt',case when prompt.id is null then null else
     jsonb_build_object('id',prompt.id,'kind',prompt.kind,'body',prompt.body,'revealed',prompt.revealed,
       'answerKey',case when is_teacher or prompt.revealed then prompt.answer_key else null end) end);
 if is_teacher then
   -- Filter current enrollment again when projecting learner data.
   result:=result||jsonb_build_object('participants',coalesce((
     select jsonb_agg(jsonb_build_object('studentId',p.student_id,'name',s.name,'needsHelp',p.needs_help,'answer',a.body) order by s.name,p.student_id)
     from vibe_live.participants p join public.students s on s.id=p.student_id and s.deleted_at is null
     left join vibe_live.responses a on a.prompt_id=room.current_prompt and a.student_id=p.student_id
     where p.session_id=room.id and vibe_live.can_join(s.id,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id)
   ),'[]'::jsonb));
 else
   result:=result||jsonb_build_object('ownAnswer',(select a.body from vibe_live.responses a where a.prompt_id=room.current_prompt and a.student_id=learner),
     'needsHelp',(select p.needs_help from vibe_live.participants p where p.session_id=room.id and p.student_id=learner));
 end if;
 return result;
end;
$$;
revoke all on function vibe_live.command(text,uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function vibe_live.command(text,uuid,uuid,integer,jsonb) to authenticated;

create function public.vibe_live_command(p_action text,p_class_id uuid,p_session_id uuid default null,p_version integer default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
 select vibe_live.command(p_action,p_class_id,p_session_id,p_version,p_payload);
$$;
revoke all on function public.vibe_live_command(text,uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.vibe_live_command(text,uuid,uuid,integer,jsonb) to authenticated;
commit;
