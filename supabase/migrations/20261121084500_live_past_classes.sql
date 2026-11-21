-- Read-only Past Classes inventory through the existing authorized Live RPC.
-- No new client table grants, storage buckets or separate classroom authority.
-- Require disposable SQL/authorization CI and exact production checks before applying.
BEGIN;

DO $migration$
DECLARE
  src text := pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
  old text;
  replacement text;
  anchor text := ' if p_action=''start'' then';
  read_only_branch text;
BEGIN
  IF position('past_list' in src)>0 THEN
    RAISE EXCEPTION 'Live past-list already exists: reconcile before applying';
  END IF;

  old := 'p_action not in (''list'',''groups'',''start'',''get'',''join'',''publish'',''pause'',''resume'',''reveal'',''end'',''answer'',''help'',''ack'',''lower'',''ask'',''note'',''reply'',''workspace_get'',''workspace_save'',''materials_list'',''materials_get'',''materials_save'',''materials_delete'')';
  replacement := replace(old,'''list'',''groups''','''list'',''past_list'',''groups''');
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN
    RAISE EXCEPTION 'Unexpected canonical Live action whitelist';
  END IF;
  src := replace(src,old,replacement);

  IF (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 THEN
    RAISE EXCEPTION 'Unexpected canonical Live start branch';
  END IF;

  read_only_branch := $past$
 if p_action='past_list' then
   -- Host entries are scoped to the current authorized teaching context;
   -- learners see only sessions they actually attended and remain eligible for.
   if not hosting and learner is null then raise exception 'live_not_authorized' using errcode='42501'; end if;
   return coalesce((select jsonb_agg(
     jsonb_build_object('id',x.id,'title',x.title,'mode',x.mode,'startedAt',x.created_at,'status','ended')
     order by x.created_at desc,x.id desc)
   from (
     select r.* from vibe_live.sessions r
     where (p_class_id is null or r.class_id=p_class_id)
       and (r.status='ended' or r.expires_at<=now())
       and vibe_live.host_allowed(r.teacher_id,r.mode,r.class_id,r.school_id,r.group_id)
       and (case when hosting
            then r.teacher_id=caller and (r.mode<>'school' or (r.class_id=p_class_id and can_teach))
            else r.teacher_id<>caller
              and exists(select 1 from vibe_live.participants p where p.session_id=r.id and p.student_id=learner)
              and vibe_live.can_join(learner,r.teacher_id,r.mode,r.class_id,r.school_id,r.group_id)
            end)
     order by r.created_at desc,r.id desc limit 30
   ) x),'[]'::jsonb);
 end if;
$past$;

  src := replace(src,anchor,read_only_branch||anchor);
  EXECUTE src;
END $migration$;

-- Preserve the existing public SECURITY INVOKER wrapper and its private
-- SECURITY DEFINER command. No anonymous grant or new RPC is created.
COMMIT;
