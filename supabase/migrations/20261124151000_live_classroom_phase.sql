-- One canonical room phase, synchronized through existing Live snapshots.
begin;
alter table vibe_live.sessions add column teaching_phase text not null default 'teaching'
 check(teaching_phase in ('teaching','activity','discussion'));
update vibe_live.sessions s set teaching_phase='activity'
 where exists(select 1 from vibe_live.prompts q where q.id=s.current_prompt and q.kind in ('exercise','quiz','poll'));
do $migration$
declare
 src text:=pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
 old text; replacement text;
begin
 old:=$anchor$if p_action is null or p_action not in ($anchor$;
 replacement:=old||$anchor$'phase_set',$anchor$;
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live whitelist'; end if;
 src:=replace(src,old,replacement);
 old:=$anchor$update vibe_live.sessions set current_prompt=prompt.id,version=version+1 where id=room.id returning * into room;$anchor$;
 replacement:=$anchor$update vibe_live.sessions set current_prompt=prompt.id,
   teaching_phase=case when kind in ('quiz','exercise','poll') then 'activity' else 'teaching' end,
   chat_enabled=case when room.teaching_phase='discussion' then false else room.chat_enabled end,
   version=version+1 where id=room.id returning * into room;$anchor$;
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live publish transition'; end if;
 src:=replace(src,old,replacement);
 old:=$anchor$ elsif p_action in ('pause','resume','end') then$anchor$;
 replacement:=$phase$
 elsif p_action='phase_set' then
   if not is_teacher then raise exception 'live_teacher_required' using errcode='42501'; end if;
   if room.status<>'active' or room.version is distinct from p_version then raise exception 'live_stale_or_paused'; end if;
   if coalesce(p_payload->>'phase','') not in ('teaching','activity','discussion') then raise exception 'live_invalid_phase'; end if;
   update vibe_live.sessions set teaching_phase=p_payload->>'phase',
     chat_enabled=case when p_payload->>'phase'='discussion' then true when room.teaching_phase='discussion' then false else room.chat_enabled end,
     version=version+1 where id=room.id returning * into room;
$phase$;
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live phase transition'; end if;
 src:=replace(src,old,replacement||old);
 old:=$anchor$'teacher',is_teacher,'mode',room.mode,$anchor$;
 replacement:=old||$anchor$'teachingPhase',room.teaching_phase,$anchor$;
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live snapshot'; end if;
 src:=replace(src,old,replacement);
 execute src;
end $migration$;
commit;
