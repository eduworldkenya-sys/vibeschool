-- Canonical migration for independent slide assignments; no room photo grants.
begin;
-- access: owner-only vibe_live.study_assignments
-- authorization-test: vibe_live.study_assignments; scripts/test-live-slide-study.mjs
create table vibe_live.study_assignments(
 id uuid primary key, owner_id uuid not null references public.profiles(id),
 material_id uuid not null, material_revision integer not null check(material_revision>0),
 source_session_id uuid references vibe_live.sessions(id) on delete restrict,
 mode text not null check(mode in ('school','tuition','homeschool')),
 class_id uuid, school_id uuid, group_id uuid,
 title text not null check(char_length(title) between 1 and 120),
 slides jsonb not null check(jsonb_typeof(slides)='array' and pg_column_size(slides)<=180000),
 keys jsonb not null default '{}'::jsonb check(jsonb_typeof(keys)='object' and pg_column_size(keys)<=64000),
 created_at timestamptz not null default now(), revoked_at timestamptz
);
-- access: owner-only vibe_live.study_recipients
-- authorization-test: vibe_live.study_recipients; scripts/test-live-slide-study.mjs
create table vibe_live.study_recipients(
 assignment_id uuid not null references vibe_live.study_assignments(id) on delete cascade,
 student_id uuid not null references public.students(id),
 page integer not null default 0 check(page between 0 and 29),
 visited integer[] not null default '{}'::integer[] check(cardinality(visited)<=30),
 answers jsonb not null default '{}'::jsonb check(jsonb_typeof(answers)='object' and pg_column_size(answers)<=64000),
 updated_at timestamptz not null default now(),
 primary key(assignment_id,student_id)
);
create index on vibe_live.study_assignments(owner_id,created_at desc);
create index on vibe_live.study_recipients(student_id,assignment_id);
alter table vibe_live.study_assignments enable row level security;
alter table vibe_live.study_recipients enable row level security;
revoke all on vibe_live.study_assignments,vibe_live.study_recipients from public,anon,authenticated,service_role;

-- Authorization is always resolved from the canonical Live membership rules.
create function vibe_live.study_command(p_action text,p_class uuid,p_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 caller uuid:=auth.uid(); learner uuid; learner_count integer; school uuid; mode_value text; group_value uuid;
 m vibe_live.teacher_materials%rowtype; a vibe_live.study_assignments%rowtype; r vibe_live.study_recipients%rowtype;
 source_room vibe_live.sessions%rowtype; source_room_id uuid;
 public_deck jsonb:='[]'::jsonb; answer_keys jsonb:='{}'::jsonb; s jsonb; n jsonb; q jsonb; k jsonb;
 idx integer:=0; page_value integer; option_value integer; correct_index integer; body_value text; notes_value text;
 feedback jsonb; result jsonb; recipient_count integer;
begin
 if caller is null or not exists(select 1 from public.profiles p where p.id=caller and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then
  raise exception 'live_not_authorized' using errcode='42501';
 end if;
 if p_action is null or p_action not in ('list_owner','create','create_from_room','revoke','list','get','advance','answer') or jsonb_typeof(p_payload) is distinct from 'object' or pg_column_size(p_payload)>8000 then raise exception 'live_invalid_request'; end if;
 if p_action='list_owner' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'slideCount',jsonb_array_length(x.slides),'mode',x.mode,'revoked',x.revoked_at is not null,'assignedCount',(select count(*) from vibe_live.study_recipients r0 where r0.assignment_id=x.id),'completedCount',(select count(*) from vibe_live.study_recipients r0 where r0.assignment_id=x.id and cardinality(r0.visited)=jsonb_array_length(x.slides))) order by x.created_at desc) from (select * from vibe_live.study_assignments where owner_id=caller and (p_class is null or class_id=p_class) order by created_at desc limit 50)x),'[]'::jsonb);
 end if;
 if p_action in ('create','create_from_room') then
  if p_id is null then raise exception 'live_invalid_assignment'; end if;
  if p_action='create_from_room' then
   if coalesce(p_payload->>'roomId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'live_invalid_source_room'; end if;
   source_room_id:=(p_payload->>'roomId')::uuid;
   select * into source_room from vibe_live.sessions s0 where s0.id=source_room_id and s0.teacher_id=caller and s0.class_id is not distinct from p_class for share;
   if not found or source_room.mode='open' or (source_room.status<>'ended' and source_room.expires_at>now()) then raise exception 'live_not_authorized' using errcode='42501'; end if;
   mode_value:=source_room.mode;
   group_value:=source_room.group_id;
  else
   mode_value:=case when p_class is not null then 'school' else p_payload->>'mode' end;
   group_value:=nullif(p_payload->>'groupId','')::uuid;
  end if;
  if mode_value is null or mode_value not in ('school','tuition','homeschool') then raise exception 'live_invalid_mode'; end if;
  if group_value is not null and mode_value<>'tuition' then raise exception 'live_invalid_group'; end if;
  if p_class is not null then
   select c.school_id into school from public.classes c where c.id=p_class;
   if school is null or not coalesce(public.teacher_can_access_class(p_class,null,false),false) or not coalesce((public.teacher_get_operating_context(null)->>'school_id')=school::text,false) then raise exception 'live_not_authorized' using errcode='42501'; end if;
  end if;
  if not vibe_live.host_allowed(caller,mode_value,p_class,school,group_value) then raise exception 'live_not_authorized' using errcode='42501'; end if;
  perform 1 from public.profiles where id=caller for update;
  select * into a from vibe_live.study_assignments where id=p_id;
  if found then
   if a.owner_id<>caller or a.material_id::text is distinct from p_payload->>'materialId' or a.material_revision::text is distinct from p_payload->>'revision' or a.class_id is distinct from p_class or a.mode<>mode_value or a.group_id is distinct from group_value or a.source_session_id is distinct from source_room_id or a.revoked_at is not null then raise exception 'live_assignment_conflict'; end if;
   return jsonb_build_object('id',a.id);
  end if;
  if (select count(*) from vibe_live.study_assignments where owner_id=caller and revoked_at is null)>=40 then raise exception 'live_assignment_limit'; end if;
  select * into m from vibe_live.teacher_materials where id=nullif(p_payload->>'materialId','')::uuid and owner_id=caller;
  if not found or m.revision::text is distinct from p_payload->>'revision' or not vibe_live.valid_draft_deck(m.deck) then raise exception 'live_invalid_material'; end if;
  for s in select value from jsonb_array_elements(m.deck) loop
   body_value:=s->>'body';
   -- Room-scoped photos have an independent authorization lifecycle; do not expose original room assets.
   if left(body_value,13)='VSLIDEPHOTO1:' then raise exception 'live_study_photo_requires_assignment_storage'; end if;
   if btrim(s->>'title')='' and btrim(body_value)='' and coalesce(s->>'diagram','none')='none' then raise exception 'live_study_empty_slide'; end if;
   public_deck:=public_deck||jsonb_build_array(s-'notes');
   if left(body_value,11)='VSLIDEASK1:' then
    begin
     q:=substring(body_value from 12)::jsonb;
     if jsonb_typeof(q) is distinct from 'object' or coalesce(q->>'kind','') not in ('quiz','poll') or jsonb_typeof(q->'options') is distinct from 'array' or jsonb_array_length(q->'options') not between 2 and 6 then raise exception 'live_invalid_activity'; end if;
     if q->>'kind'='quiz' then
      notes_value:=coalesce(s->>'notes','');
      if left(notes_value,13)<>'VSLIDENOTES1:' then raise exception 'live_study_answer_required'; end if;
      n:=substring(notes_value from 14)::jsonb;k:=n->'assessment';
      if k->>'body' is distinct from body_value or coalesce(k->>'option','')!~'^[0-5]$' or jsonb_typeof(k->'explanation') is distinct from 'string' or char_length(k->>'explanation')>800 then raise exception 'live_study_answer_required'; end if;
      correct_index:=(k->>'option')::integer;
      if correct_index>=jsonb_array_length(q->'options') then raise exception 'live_study_answer_required'; end if;
      answer_keys:=answer_keys||jsonb_build_object(idx::text,jsonb_build_object('option',correct_index,'explanation',k->>'explanation'));
     end if;
    exception when others then raise exception 'live_study_invalid_or_unprepared_activity at slide %',idx+1;
    end;
   end if;
   idx:=idx+1;
  end loop;
  insert into vibe_live.study_assignments(id,owner_id,material_id,material_revision,source_session_id,mode,class_id,school_id,group_id,title,slides,keys)
  values(p_id,caller,m.id,m.revision,source_room_id,mode_value,p_class,school,group_value,m.title,public_deck,answer_keys);
  insert into vibe_live.study_recipients(assignment_id,student_id)
  select p_id,st.id from public.students st where vibe_live.can_join(st.id,caller,mode_value,p_class,school,group_value);
  get diagnostics recipient_count=row_count;
  if recipient_count=0 then raise exception 'live_study_no_eligible_learners'; end if;
  return jsonb_build_object('id',p_id,'recipientCount',recipient_count);
 end if;
 if p_action='revoke' then
  update vibe_live.study_assignments set revoked_at=coalesce(revoked_at,now()) where id=p_id and owner_id=caller and (p_class is null or class_id=p_class);
  if not found then raise exception 'live_not_authorized' using errcode='42501'; end if;
  return jsonb_build_object('revoked',true);
 end if;
 select count(*),min(st.id::text)::uuid into learner_count,learner from public.students st where st.profile_id=caller and vibe_live.eligible_student(st.id);
 if learner_count<>1 then raise exception 'live_not_authorized' using errcode='42501'; end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'slideCount',jsonb_array_length(x.slides),'completed',cardinality(x.visited),'page',x.page) order by x.created_at desc) from (
   select a0.*,r0.page,r0.visited from vibe_live.study_recipients r0 join vibe_live.study_assignments a0 on a0.id=r0.assignment_id
   where r0.student_id=learner and a0.revoked_at is null and (p_class is null or a0.class_id=p_class)
   and vibe_live.can_join(learner,a0.owner_id,a0.mode,a0.class_id,a0.school_id,a0.group_id) order by a0.created_at desc limit 50)x),'[]'::jsonb);
 end if;
 select * into a from vibe_live.study_assignments where id=p_id and revoked_at is null and (p_class is null or class_id=p_class) for share;
 if not found or not vibe_live.can_join(learner,a.owner_id,a.mode,a.class_id,a.school_id,a.group_id) then raise exception 'live_not_authorized' using errcode='42501'; end if;
 select * into r from vibe_live.study_recipients where assignment_id=a.id and student_id=learner for update;
 if not found then raise exception 'live_not_authorized' using errcode='42501'; end if;
 if p_action in ('advance','answer') then
  if coalesce(p_payload->>'page','')!~'^[0-9]{1,2}$' then raise exception 'live_invalid_page'; end if;
  page_value:=(p_payload->>'page')::integer;
  if page_value<0 or page_value>=jsonb_array_length(a.slides) then raise exception 'live_invalid_page'; end if;
  s:=a.slides->page_value;body_value:=s->>'body';
  if p_action='answer' then
   if left(body_value,11)<>'VSLIDEASK1:' or coalesce(p_payload->>'option','')!~'^[0-5]$' then raise exception 'live_invalid_activity'; end if;
   q:=substring(body_value from 12)::jsonb;option_value:=(p_payload->>'option')::integer;
   if option_value>=jsonb_array_length(q->'options') then raise exception 'live_invalid_answer'; end if;
   if not(r.answers?page_value::text) then
    k:=a.keys->(page_value::text);
    feedback:=jsonb_build_object('selected',option_value,'kind',q->>'kind');
    if q->>'kind'='quiz' and k is not null then feedback:=feedback||jsonb_build_object('correct',option_value=(k->>'option')::integer,'correctOption',(k->>'option')::integer,'explanation',k->>'explanation'); end if;
    r.answers:=r.answers||jsonb_build_object(page_value::text,feedback);
   end if;
  else
   if coalesce(p_payload->>'complete','false')='true' then
    if left(body_value,11)='VSLIDEASK1:' and not(r.answers?page_value::text) then raise exception 'live_study_answer_required'; end if;
    if not(page_value=any(r.visited)) then r.visited:=array_append(r.visited,page_value);end if;
    r.page:=least(page_value+1,jsonb_array_length(a.slides)-1);
   else r.page:=page_value;
   end if;
  end if;
  update vibe_live.study_recipients set page=r.page,visited=r.visited,answers=r.answers,updated_at=now() where assignment_id=a.id and student_id=learner;
 end if;
 return jsonb_build_object('id',a.id,'title',a.title,'slides',a.slides,'page',r.page,'visited',to_jsonb(r.visited),'answers',r.answers);
end;
$$;
revoke all on function vibe_live.study_command(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function vibe_live.study_command(text,uuid,uuid,jsonb) to authenticated;
create function public.vibe_live_study_command(p_action text,p_class uuid default null,p_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select vibe_live.study_command(p_action,p_class,p_id,p_payload); $$;
revoke all on function public.vibe_live_study_command(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.vibe_live_study_command(text,uuid,uuid,jsonb) to authenticated;
commit;
