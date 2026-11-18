-- Bounded live-classroom pilot: transient formative interactions, not formal grades.
-- access: authenticated RPC only; private storage and per-action membership validation.
begin;
create schema vibe_live;
revoke all on schema vibe_live from public, anon, authenticated;
grant usage on schema vibe_live to authenticated;

create table vibe_live.sessions (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.classes(id) on delete restrict,
 school_id uuid not null,
 teacher_id uuid not null references public.profiles(id) on delete restrict,
 title text not null check (char_length(title) between 1 and 120),
 status text not null default 'active' check(status in ('active','paused','ended')),
 version integer not null default 0,
 current_prompt uuid,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '2 hours')
);
create unique index live_one_session_per_teacher_class on vibe_live.sessions(class_id,teacher_id) where status in ('active','paused');
create index live_class_session_lookup on vibe_live.sessions(class_id,created_at desc);
create table vibe_live.prompts (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references vibe_live.sessions(id) on delete restrict,
 kind text not null check(kind in ('teach','quiz','exercise','poll')),
 body text not null check(char_length(body) between 1 and 4000),
 answer_key text check(char_length(answer_key)<=2000),
 revealed boolean not null default false,
 created_at timestamptz not null default now()
);
create table vibe_live.participants (
 session_id uuid not null references vibe_live.sessions(id) on delete restrict,
 student_id uuid not null references public.students(id) on delete restrict,
 joined_at timestamptz not null default now(),
 needs_help boolean not null default false,
 primary key(session_id,student_id)
);
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
revoke all on all tables in schema vibe_live from public,anon,authenticated;

-- The single RPC resolves the actor from auth.uid(), never client-supplied identity.
create function vibe_live.command(p_action text,p_class_id uuid,p_session_id uuid,p_version integer,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 caller uuid := auth.uid();
 school uuid; learner uuid; learner_count integer;
 can_teach boolean := false; is_teacher boolean := false;
 room vibe_live.sessions%rowtype; prompt vibe_live.prompts%rowtype;
 kind text; body text; key_text text; target uuid; result jsonb;
begin
 if caller is null or p_class_id is null or not exists (
   select 1 from public.profiles p where p.id=caller and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
 ) then raise exception 'live_not_authorized' using errcode='42501'; end if;
 if p_action is null or p_action not in ('list','start','get','join','publish','pause','resume','reveal','end','answer','help','ack')
 or p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>28000 then
   raise exception 'live_invalid_request' using errcode='22023';
 end if;
 select c.school_id into school from public.classes c where c.id=p_class_id;
 if school is null then raise exception 'live_not_authorized' using errcode='42501'; end if;
 if coalesce(public.teacher_can_access_class(p_class_id,null,false),false) then
   can_teach := (public.teacher_get_operating_context(null)->>'school_id')=school::text;
 end if;
 select count(*), min(s.id::text)::uuid into learner_count,learner
 from public.students s where s.profile_id=caller and s.deleted_at is null and exists(
   select 1 from public.student_classes sc where sc.student_id=s.id and sc.class_id=p_class_id and sc.school_id=school and sc.is_current
 );
 if learner_count<>1 then learner:=null; end if;
 if not coalesce(can_teach,false) and learner is null then raise exception 'live_not_authorized' using errcode='42501'; end if;

 if p_action='list' then
   return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'status',x.status,'own',x.teacher_id=caller) order by x.created_at desc)
   from (select r.* from vibe_live.sessions r where r.class_id=p_class_id and r.school_id=school and r.status in ('active','paused') and r.expires_at>now()
     and ((can_teach and r.teacher_id=caller) or learner is not null) order by r.created_at desc,r.id limit 30) x),'[]'::jsonb);
 end if;
 if p_action='start' then
   if not coalesce(can_teach,false) then raise exception 'live_teacher_required' using errcode='42501'; end if;
   body:=btrim(coalesce(p_payload->>'title',''));
   if char_length(body) not between 1 and 120 then raise exception 'live_title_required'; end if;
   -- Lock the canonical teacher row to serialize concurrent starts without duplicate sessions.
   perform 1 from public.profiles where id=caller for update;
   update vibe_live.sessions set status='ended',version=version+1 where teacher_id=caller and class_id=p_class_id and status in ('active','paused') and expires_at<=now();
   select * into room from vibe_live.sessions where teacher_id=caller and class_id=p_class_id and status in ('active','paused');
   if not found then
     if exists(select 1 from vibe_live.sessions where teacher_id=caller and class_id=p_class_id and created_at>now()-interval '10 seconds') then raise exception 'live_try_again'; end if;
     insert into vibe_live.sessions(class_id,school_id,teacher_id,title) values(p_class_id,school,caller,body) returning * into room;
   end if;
 else
   if p_action='get' then
     select * into room from vibe_live.sessions where id=p_session_id and class_id=p_class_id and school_id=school for share;
   else
     select * into room from vibe_live.sessions where id=p_session_id and class_id=p_class_id and school_id=school for update;
   end if;
   if not found then raise exception 'live_not_authorized' using errcode='42501'; end if;
 end if;
 is_teacher:=coalesce(can_teach,false) and room.teacher_id=caller;
 if not is_teacher and learner is null then raise exception 'live_not_authorized' using errcode='42501'; end if;
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
   if kind is null or kind not in ('teach','quiz','exercise','poll') or char_length(body) not between 1 and 4000 or char_length(coalesce(key_text,''))>2000
    or (kind in ('teach','poll') and key_text is not null) then raise exception 'live_invalid_prompt'; end if;
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
   if not found or prompt.kind='teach' or prompt.revealed or char_length(body) not between 1 and 2000
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
   'teacher',is_teacher,'expiresAt',room.expires_at,'prompt',case when prompt.id is null then null else
     jsonb_build_object('id',prompt.id,'kind',prompt.kind,'body',prompt.body,'revealed',prompt.revealed,
       'answerKey',case when is_teacher or prompt.revealed then prompt.answer_key else null end) end);
 if is_teacher then
   -- Filter current enrollment again when projecting learner data.
   result:=result||jsonb_build_object('participants',coalesce((
     select jsonb_agg(jsonb_build_object('studentId',p.student_id,'name',s.name,'needsHelp',p.needs_help,'answer',a.body) order by s.name,p.student_id)
     from vibe_live.participants p join public.students s on s.id=p.student_id and s.deleted_at is null
     left join vibe_live.responses a on a.prompt_id=room.current_prompt and a.student_id=p.student_id
     where p.session_id=room.id and exists(select 1 from public.student_classes sc where sc.student_id=s.id and sc.class_id=room.class_id and sc.school_id=room.school_id and sc.is_current)
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
