-- Extend the canonical Live command; no new admission or public table access.
begin;
-- access: owner-only vibe_live.workbook_entries
-- authorization-test: scripts/test-live-workbook-contract.mjs
create table vibe_live.workbook_entries (
 session_id uuid not null references vibe_live.sessions(id) on delete cascade,
 prompt_id uuid not null references vibe_live.prompts(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete restrict,
 revision integer not null default 1 check (revision>0),
 status text not null check(status in ('draft','submitted','returned','accepted')),
 body text not null check(char_length(body)<=4000),
 drawing text not null default '' check(char_length(drawing)<=3500),
 feedback text not null default '' check(char_length(feedback)<=2000),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(session_id,prompt_id,student_id),
 foreign key(session_id,student_id) references vibe_live.participants(session_id,student_id) on delete cascade
);
alter table vibe_live.workbook_entries enable row level security;
revoke all on vibe_live.workbook_entries from public,anon,authenticated,service_role;
do $migration$
declare
 src text:=pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
 old text; replacement text;
begin
 old:='result jsonb;';
 replacement:=old||' wb vibe_live.workbook_entries%rowtype; wb_prompt uuid; wb_student uuid; wb_revision integer; wb_body text; wb_drawing text; wb_feedback text;';
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live declaration'; end if;
 src:=replace(src,old,replacement);
 old:=$a$'wait_list','wait_decide')$a$||E'\n or p_payload is null';
 replacement:=$a$'wait_list','wait_decide','workbook_list','workbook_save','workbook_submit','workbook_return','workbook_accept')$a$||E'\n or p_payload is null';
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live whitelist'; end if;
 src:=replace(src,old,replacement);
 old:=$a$if p_action not in ('get','start','dm_list','dm_read') and$a$;
 replacement:=$a$if p_action not in ('get','start','dm_list','dm_read','workbook_list','workbook_return','workbook_accept') and$a$;
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live close gate'; end if;
 src:=replace(src,old,replacement);
 old:=$a$ if p_action in ('workspace_get','workspace_save') then$a$;
 replacement:=$workbook$
 -- Executed only after canonical role, room and participant admission.
 if p_action in ('workbook_list','workbook_save','workbook_submit','workbook_return','workbook_accept') then
   if coalesce(p_payload->>'promptId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'live_invalid_workbook_prompt'; end if;
   wb_prompt:=(p_payload->>'promptId')::uuid;
   if not exists(select 1 from vibe_live.prompts q where q.id=wb_prompt and q.session_id=room.id and q.kind in ('exercise','quiz')) then raise exception 'live_invalid_workbook_prompt'; end if;
   if p_action='workbook_list' then
     return jsonb_build_object('entries',coalesce((
       select jsonb_agg(jsonb_build_object('studentId',w.student_id,'name',s.name,'revision',w.revision,'status',w.status,
         'body',w.body,'drawing',w.drawing,'feedback',w.feedback,'updatedAt',w.updated_at) order by s.name,w.student_id)
       from vibe_live.workbook_entries w join public.students s on s.id=w.student_id and s.deleted_at is null
       where w.session_id=room.id and w.prompt_id=wb_prompt
       and ((is_teacher and w.status<>'draft' and vibe_live.can_join(w.student_id,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id))
         or (not is_teacher and w.student_id=learner))
     ),'[]'::jsonb));
   end if;
   if p_action in ('workbook_return','workbook_accept') then
     if not is_teacher then raise exception 'live_not_authorized' using errcode='42501'; end if;
     if coalesce(p_payload->>'studentId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'live_invalid_workbook_student'; end if;
     wb_student:=(p_payload->>'studentId')::uuid;
     if not vibe_live.can_join(wb_student,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id) then raise exception 'live_not_authorized' using errcode='42501'; end if;
   else
     if is_teacher or learner is null then raise exception 'live_not_authorized' using errcode='42501'; end if;
     wb_student:=learner;
   end if;
   if coalesce(p_payload->>'revision','') !~ '^[0-9]{1,9}$' then raise exception 'live_invalid_revision'; end if;
   wb_revision:=(p_payload->>'revision')::integer;
   select * into wb from vibe_live.workbook_entries w where w.session_id=room.id and w.prompt_id=wb_prompt and w.student_id=wb_student for update;
   if coalesce(wb.revision,0)<>wb_revision then raise exception 'live_workbook_conflict'; end if;
   if p_action in ('workbook_return','workbook_accept') then
     wb_feedback:=btrim(coalesce(p_payload->>'feedback',''));
     if wb.status is distinct from 'submitted' or char_length(wb_feedback) not between 1 and 2000 then raise exception 'live_invalid_workbook_feedback'; end if;
     update vibe_live.workbook_entries w set status=case when p_action='workbook_accept' then 'accepted' else 'returned' end,
       feedback=wb_feedback,revision=w.revision+1,updated_at=clock_timestamp()
       where w.session_id=room.id and w.prompt_id=wb_prompt and w.student_id=wb_student returning * into wb;
   else
     if room.status<>'active' or (wb.status is not null and wb.status not in ('draft','returned')) then raise exception 'live_workbook_not_editable'; end if;
     if wb.status is distinct from 'returned' and not exists(select 1 from vibe_live.prompts q where q.id=wb_prompt and q.id=room.current_prompt and not q.revealed) then raise exception 'live_workbook_not_open'; end if;
     wb_body:=coalesce(p_payload->>'body',''); wb_drawing:=coalesce(p_payload->>'drawing','');
     if char_length(wb_body)>4000 or char_length(wb_drawing)>3500 or (wb_drawing<>'' and not vibe_live.valid_object_board(wb_drawing))
       or (p_action='workbook_submit' and btrim(wb_body)='' and wb_drawing='') then raise exception 'live_invalid_workbook_content'; end if;
     insert into vibe_live.workbook_entries(session_id,prompt_id,student_id,revision,status,body,drawing)
     values(room.id,wb_prompt,wb_student,wb_revision+1,case when p_action='workbook_submit' then 'submitted' else 'draft' end,wb_body,wb_drawing)
     on conflict(session_id,prompt_id,student_id) do update set revision=excluded.revision,
       status=case when p_action='workbook_save' and vibe_live.workbook_entries.status='returned' then 'returned' else excluded.status end,
       body=excluded.body,drawing=excluded.drawing,updated_at=clock_timestamp()
       returning * into wb;
   end if;
   return jsonb_build_object('revision',wb.revision,'status',wb.status,'body',wb.body,'drawing',wb.drawing,'feedback',wb.feedback,'updatedAt',wb.updated_at,'studentId',wb.student_id);
 end if;
$workbook$;
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live post-admission anchor'; end if;
 src:=replace(src,old,replacement||old);
 execute src;
end $migration$;
commit;
