-- P1 Dynamic Learning Transformations: source-grounded personalized representation cache.
-- Live Supabase ledger: 20260808002627

create table if not exists public.student_learning_transformations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  chapter_id uuid not null references public.vibe_chapters(id) on delete cascade,
  representation text not null check (representation in ('immersive','simplify','mind_map','flashcards','quiz','audio_lesson','revision_sheet','worked_examples','visual_explainer','story_mode')),
  source_version text not null,
  personalization_key text not null,
  payload jsonb not null,
  generator text not null default 'learning-transform-v1',
  model text,
  quality jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique(student_id, chapter_id, representation, source_version, personalization_key)
);
create index if not exists student_learning_transformations_student_idx on public.student_learning_transformations(student_id, updated_at desc);
create index if not exists student_learning_transformations_chapter_idx on public.student_learning_transformations(chapter_id, representation, updated_at desc);

create table if not exists public.student_learning_transformation_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  transformation_id uuid not null references public.student_learning_transformations(id) on delete cascade,
  event_type text not null check (event_type in ('viewed','completed','helpful','not_helpful')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists student_learning_transformation_events_student_idx on public.student_learning_transformation_events(student_id, created_at desc);
create index if not exists student_learning_transformation_events_transform_idx on public.student_learning_transformation_events(transformation_id, created_at desc);

alter table public.student_learning_transformations enable row level security;
alter table public.student_learning_transformation_events enable row level security;

drop policy if exists student_learning_transformations_select_own on public.student_learning_transformations;
create policy student_learning_transformations_select_own on public.student_learning_transformations for select to authenticated
using (exists (select 1 from public.students s where s.id=student_learning_transformations.student_id and s.profile_id=auth.uid() and s.deleted_at is null));

drop policy if exists student_learning_transformation_events_select_own on public.student_learning_transformation_events;
create policy student_learning_transformation_events_select_own on public.student_learning_transformation_events for select to authenticated
using (exists (select 1 from public.students s where s.id=student_learning_transformation_events.student_id and s.profile_id=auth.uid() and s.deleted_at is null));

grant select on public.student_learning_transformations to authenticated;
grant select on public.student_learning_transformation_events to authenticated;
revoke insert,update,delete on public.student_learning_transformations from authenticated,anon;
revoke insert,update,delete on public.student_learning_transformation_events from authenticated,anon;

create or replace function public.student_get_learning_transform_context(p_chapter_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_student_id uuid; v_chapter public.vibe_chapters%rowtype; v_publication public.vibe_publications%rowtype;
  v_brain jsonb; v_weak jsonb; v_source_text text; v_source_version text; v_personalization_key text;
  v_mastery_bucket integer:=0; v_session_minutes integer:=25;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  select * into v_chapter from public.vibe_chapters where id=p_chapter_id;
  if v_chapter.id is null then raise exception 'chapter_not_found'; end if;
  if not public.can_viewer_read_chapter(p_chapter_id,v_uid) then raise exception 'chapter_not_available'; end if;
  select * into v_publication from public.vibe_publications where id=v_chapter.publication_id;
  v_brain:=public.student_get_twin_brain_cached();
  select value into v_weak from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value
  where not exists(select 1 from public.chapter_learning_outcome_links l where l.chapter_id=p_chapter_id)
     or nullif(value->>'outcome_id','')::uuid in (select l.outcome_id from public.chapter_learning_outcome_links l where l.chapter_id=p_chapter_id)
  order by coalesce((value->>'effective_mastery')::numeric,0),coalesce((value->>'forgetting_risk')::numeric,0) desc limit 1;
  if v_weak is null then select value into v_weak from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value order by coalesce((value->>'effective_mastery')::numeric,0) limit 1; end if;
  v_mastery_bucket:=greatest(0,least(10,floor(coalesce((v_weak->>'effective_mastery')::numeric,0)/10)::integer));
  v_session_minutes:=greatest(10,least(90,coalesce((v_brain #>> '{study_time,session_minutes}')::integer,25)));
  select left(string_agg(case coalesce(b.value->>'type','paragraph') when 'heading1' then E'\n# '||coalesce(b.value->>'content','') when 'heading2' then E'\n## '||coalesce(b.value->>'content','') when 'heading3' then E'\n### '||coalesce(b.value->>'content','') when 'question' then E'\nQuestion: '||coalesce(b.value->>'content','') when 'activity' then E'\nActivity: '||coalesce(b.value->>'content','') else E'\n'||coalesce(b.value->>'content','') end,'' order by b.ordinality),45000)
  into v_source_text from jsonb_array_elements(case when jsonb_typeof(v_chapter.blocks)='array' then v_chapter.blocks else '[]'::jsonb end) with ordinality as b(value,ordinality);
  v_source_text:=regexp_replace(coalesce(v_source_text,''),'<[^>]+>',' ','g');
  v_source_version:=md5(v_chapter.updated_at::text||':'||coalesce(v_chapter.content_pack_version,0)::text||':'||v_chapter.blocks::text);
  v_personalization_key:=md5(v_student_id::text||':'||coalesce(v_publication.cbc_grade,'')||':'||coalesce(v_weak->>'outcome_id','none')||':'||v_mastery_bucket::text||':'||v_session_minutes::text);
  return jsonb_build_object('student_id',v_student_id,'publication_id',v_publication.id,'publication_title',v_publication.title,'chapter_id',v_chapter.id,'chapter_title',v_chapter.title,'source_version',v_source_version,'personalization_key',v_personalization_key,'source_text',v_source_text,'source_truncated',length(coalesce(v_source_text,''))>=45000,'curriculum',jsonb_build_object('framework',v_publication.curriculum_framework,'grade',v_publication.cbc_grade,'subject',v_publication.cbc_subject,'strand',v_chapter.cbc_strand,'learning_outcomes',v_chapter.learning_outcomes,'alignment_status',v_chapter.alignment_status),'learner',jsonb_build_object('weak_outcome',v_weak,'twin_confidence',v_brain->'confidence','session_minutes',v_session_minutes,'target_grade',v_brain #> '{exam,target_grade}','forgetting_risk',v_weak->'forgetting_risk','mastery_bucket',v_mastery_bucket));
end $$;

create or replace function public.student_get_cached_learning_transformation(p_chapter_id uuid,p_representation text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ctx jsonb; v_student_id uuid; v_row public.student_learning_transformations%rowtype; begin
  if p_representation not in ('immersive','simplify','mind_map','flashcards','quiz','audio_lesson','revision_sheet','worked_examples','visual_explainer','story_mode') then raise exception 'unsupported_representation'; end if;
  v_ctx:=public.student_get_learning_transform_context(p_chapter_id); v_student_id:=(v_ctx->>'student_id')::uuid;
  select * into v_row from public.student_learning_transformations t where t.student_id=v_student_id and t.chapter_id=p_chapter_id and t.representation=p_representation and t.source_version=v_ctx->>'source_version' and t.personalization_key=v_ctx->>'personalization_key' and t.expires_at>now() order by t.updated_at desc limit 1;
  if v_row.id is null then return null; end if;
  return jsonb_build_object('id',v_row.id,'representation',v_row.representation,'payload',v_row.payload,'source_version',v_row.source_version,'personalization_key',v_row.personalization_key,'generator',v_row.generator,'model',v_row.model,'quality',v_row.quality,'cached',true,'updated_at',v_row.updated_at,'expires_at',v_row.expires_at);
end $$;

create or replace function public.student_store_learning_transformation(p_chapter_id uuid,p_representation text,p_source_version text,p_personalization_key text,p_payload jsonb,p_model text default null,p_quality jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ctx jsonb; v_student_id uuid; v_publication_id uuid; v_id uuid; begin
  if p_representation not in ('immersive','simplify','mind_map','flashcards','quiz','audio_lesson','revision_sheet','worked_examples','visual_explainer','story_mode') then raise exception 'unsupported_representation'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_transformation_payload'; end if;
  v_ctx:=public.student_get_learning_transform_context(p_chapter_id);
  if p_source_version is distinct from v_ctx->>'source_version' or p_personalization_key is distinct from v_ctx->>'personalization_key' then raise exception 'stale_transformation_context'; end if;
  v_student_id:=(v_ctx->>'student_id')::uuid; v_publication_id:=(v_ctx->>'publication_id')::uuid;
  insert into public.student_learning_transformations(student_id,publication_id,chapter_id,representation,source_version,personalization_key,payload,model,quality,updated_at,expires_at)
  values(v_student_id,v_publication_id,p_chapter_id,p_representation,p_source_version,p_personalization_key,p_payload,p_model,coalesce(p_quality,'{}'::jsonb),now(),now()+interval '7 days')
  on conflict(student_id,chapter_id,representation,source_version,personalization_key) do update set payload=excluded.payload,model=excluded.model,quality=excluded.quality,updated_at=now(),expires_at=now()+interval '7 days' returning id into v_id;
  return jsonb_build_object('id',v_id,'stored',true);
end $$;

create or replace function public.student_record_learning_transformation_event(p_transformation_id uuid,p_event_type text,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_student_id uuid; v_t public.student_learning_transformations%rowtype; v_event_id uuid; begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_event_type not in ('viewed','completed','helpful','not_helpful') then raise exception 'unsupported_event_type'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  select * into v_t from public.student_learning_transformations where id=p_transformation_id and student_id=v_student_id;
  if v_t.id is null then raise exception 'transformation_not_found'; end if;
  insert into public.student_learning_transformation_events(student_id,transformation_id,event_type,metadata) values(v_student_id,p_transformation_id,p_event_type,coalesce(p_metadata,'{}'::jsonb)) returning id into v_event_id;
  insert into public.student_learning_events(student_id,event_type,source_type,source_id,xp_awarded,occurred_at,metadata) values(v_student_id,'learning_representation_'||p_event_type,'learning_transformation',v_t.id,0,now(),jsonb_build_object('representation',v_t.representation,'chapter_id',v_t.chapter_id,'low_authority',true)||coalesce(p_metadata,'{}'::jsonb));
  return jsonb_build_object('recorded',true,'id',v_event_id);
end $$;

revoke all on function public.student_get_learning_transform_context(uuid) from public,anon;
revoke all on function public.student_get_cached_learning_transformation(uuid,text) from public,anon;
revoke all on function public.student_store_learning_transformation(uuid,text,text,text,jsonb,text,jsonb) from public,anon;
revoke all on function public.student_record_learning_transformation_event(uuid,text,jsonb) from public,anon;
grant execute on function public.student_get_learning_transform_context(uuid) to authenticated;
grant execute on function public.student_get_cached_learning_transformation(uuid,text) to authenticated;
grant execute on function public.student_store_learning_transformation(uuid,text,text,text,jsonb,text,jsonb) to authenticated;
grant execute on function public.student_record_learning_transformation_event(uuid,text,jsonb) to authenticated;
