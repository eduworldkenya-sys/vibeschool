begin;

-- Migration-contract authorization declaration. Executable coverage is
-- exercised by supabase/tests/sow04_content_provenance_authority.sql.
-- authorization-test: public.curriculum_content_lesson_versions
create table if not exists public.curriculum_content_lesson_versions (
 id uuid primary key default gen_random_uuid(), curriculum_id uuid not null references public.curriculum(id) on delete restrict,
 curriculum_content_id uuid not null references public.curriculum_content(id) on delete restrict, content_version integer not null check(content_version>0),
 lesson_number integer not null check(lesson_number>0), lesson_key text not null unique, title text not null, lesson_context jsonb not null,
 source_snapshot jsonb not null, content_hash text not null, created_at timestamptz not null default now(),
 unique(curriculum_content_id,content_version,lesson_number), check(jsonb_typeof(lesson_context)='object'), check(jsonb_typeof(source_snapshot)='object'));
create index if not exists idx_cc_lesson_versions_curriculum on public.curriculum_content_lesson_versions(curriculum_id,lesson_number);

alter table public.scheme_of_work add column if not exists curriculum_content_lesson_version_id uuid references public.curriculum_content_lesson_versions(id) on delete restrict;
alter table public.scheme_of_work add column if not exists provenance_snapshot jsonb;
create unique index if not exists uq_scheme_curriculum_lesson_occurrence on public.scheme_of_work(class_id,subject_id,academic_term_id,curriculum_content_lesson_version_id) where source='curriculum' and curriculum_content_lesson_version_id is not null;

create or replace function public.materialize_curriculum_content_lessons(p_curriculum_content_id uuid)
returns setof public.curriculum_content_lesson_versions language plpgsql security definer set search_path='' as $f$
declare cc public.curriculum_content%rowtype; c public.curriculum%rowtype; lessons jsonb; n integer; item jsonb; snap jsonb; k text; h text; r public.curriculum_content_lesson_versions%rowtype;
begin
 select * into cc from public.curriculum_content where id=p_curriculum_content_id;
 if cc.id is null or cc.source_type<>'vibeschool' or cc.status<>'confirmed' then raise exception 'LESSON_CONTENT_NOT_CONFIRMED'; end if;
 select * into c from public.curriculum where id=cc.curriculum_id; if c.id is null then raise exception 'LESSON_CURRICULUM_REQUIRED'; end if;
 lessons:=coalesce(cc.lesson_context,'{}'::jsonb)->'lessons';
 if jsonb_typeof(lessons)<>'array' or jsonb_array_length(lessons)<>c.periods then raise exception 'LESSON_DECOMPOSITION_REQUIRED:%:expected:%',c.id,c.periods; end if;
 for n in 1..c.periods loop
  item:=lessons->(n-1); if jsonb_typeof(item)<>'object' or nullif(btrim(item->>'title'),'') is null then raise exception 'LESSON_DECOMPOSITION_INCOMPLETE:%:%',c.id,n; end if;
  snap:=jsonb_build_object('curriculum_id',c.id,'curriculum_reference',c.reference,'grade',c.grade,'subject',c.subject,'term',c.term,'strand',c.strand,'sub_strand',c.sub_strand,'content_id',cc.id,'content_version',cc.version,'content_source_type',cc.source_type,'content_status',cc.status,'lesson_number',n);
  k:=c.id::text||':'||cc.id::text||':v'||cc.version::text||':lesson:'||n::text; h:=encode(extensions.digest(convert_to(item::text,'UTF8'),'sha256'),'hex'); r:=null;
  insert into public.curriculum_content_lesson_versions(curriculum_id,curriculum_content_id,content_version,lesson_number,lesson_key,title,lesson_context,source_snapshot,content_hash)
  values(c.id,cc.id,cc.version,n,k,btrim(item->>'title'),item,snap,h)
  on conflict(curriculum_content_id,content_version,lesson_number) do update set title=excluded.title where public.curriculum_content_lesson_versions.content_hash=excluded.content_hash returning * into r;
  if r.id is null then raise exception 'LESSON_VERSION_IMMUTABLE:%',k; end if; return next r;
 end loop; return;
end;$f$;
revoke all on function public.materialize_curriculum_content_lessons(uuid) from public,anon,authenticated; grant execute on function public.materialize_curriculum_content_lessons(uuid) to service_role;

create or replace function public.materialize_confirmed_curriculum_content_lessons_trigger()
returns trigger language plpgsql security definer set search_path='' as $f$
begin
 if new.source_type='vibeschool' and new.status='confirmed' then
  perform public.materialize_curriculum_content_lessons(new.id);
 end if;
 return new;
end;$f$;
revoke all on function public.materialize_confirmed_curriculum_content_lessons_trigger() from public,anon,authenticated;
drop trigger if exists trg_materialize_confirmed_curriculum_content_lessons on public.curriculum_content;
create trigger trg_materialize_confirmed_curriculum_content_lessons
after insert or update of status,source_type,lesson_context,version on public.curriculum_content
for each row when (new.source_type='vibeschool' and new.status='confirmed')
execute function public.materialize_confirmed_curriculum_content_lessons_trigger();

do $backfill$
declare r record;
begin
 for r in
  select cc.id
  from public.curriculum_content cc
  join public.curriculum c on c.id=cc.curriculum_id
  where cc.source_type='vibeschool' and cc.status='confirmed'
    and jsonb_typeof(coalesce(cc.lesson_context,'{}'::jsonb)->'lessons')='array'
    and jsonb_array_length(coalesce(cc.lesson_context,'{}'::jsonb)->'lessons')=c.periods
    and not exists (
      select 1 from jsonb_array_elements(coalesce(cc.lesson_context,'{}'::jsonb)->'lessons') x
      where jsonb_typeof(x)<>'object' or nullif(btrim(x->>'title'),'') is null
    )
 loop
  perform public.materialize_curriculum_content_lessons(r.id);
 end loop;
end;$backfill$;

create or replace function public.scheme_capture_provenance() returns trigger language plpgsql set search_path='' as $f$
declare lv public.curriculum_content_lesson_versions%rowtype;
begin
 if new.source='curriculum' then
  if new.curriculum_content_lesson_version_id is null then raise exception 'SCHEME_LESSON_VERSION_REQUIRED'; end if;
  select * into lv from public.curriculum_content_lesson_versions where id=new.curriculum_content_lesson_version_id;
  if lv.id is null or lv.curriculum_id<>new.curriculum_id or lv.curriculum_content_id<>new.curriculum_content_id then raise exception 'SCHEME_PROVENANCE_MISMATCH'; end if;
  new.lesson_number:=lv.lesson_number; new.provenance_snapshot:=lv.source_snapshot||jsonb_build_object('lesson_key',lv.lesson_key,'content_hash',lv.content_hash);
 end if; return new;
end;$f$;
drop trigger if exists trg_scheme_capture_provenance on public.scheme_of_work;
create trigger trg_scheme_capture_provenance before insert or update of curriculum_id,curriculum_content_id,curriculum_content_lesson_version_id on public.scheme_of_work for each row execute function public.scheme_capture_provenance();

create or replace function public.scheme_provenance_immutable() returns trigger language plpgsql set search_path='' as $f$
begin if old.source='curriculum' and old.curriculum_content_lesson_version_id is not null and (new.provenance_snapshot is distinct from old.provenance_snapshot or new.curriculum_content_lesson_version_id is distinct from old.curriculum_content_lesson_version_id) then raise exception 'SCHEME_PROVENANCE_IMMUTABLE'; end if; return new; end;$f$;
drop trigger if exists trg_scheme_provenance_immutable on public.scheme_of_work;
create trigger trg_scheme_provenance_immutable before update on public.scheme_of_work for each row execute function public.scheme_provenance_immutable();

create or replace function public.commit_curriculum_scheme(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_curriculum_ids uuid[]
)
returns setof public.scheme_of_work
language plpgsql
set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_school_id uuid;
  v_grade text;
  v_term integer;
  v_global_subject_id uuid;
  v_next_sequence integer;
  v_curriculum_id uuid;
  v_curr public.curriculum%rowtype;
  v_content public.curriculum_content%rowtype;
  v_ctx jsonb;
  v_outcomes text;
  v_kiq text;
  v_experiences text;
  v_resources text;
  v_assessment text;
  v_lesson public.curriculum_content_lesson_versions%rowtype;
  v_inserted public.scheme_of_work%rowtype;
begin
  if v_uid is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  if p_curriculum_ids is null or cardinality(p_curriculum_ids)=0 then raise exception 'SCHEME_CURRICULUM_REQUIRED'; end if;
  if cardinality(p_curriculum_ids) <> (select count(distinct x) from unnest(p_curriculum_ids) x) then raise exception 'SCHEME_DUPLICATE_CURRICULUM_IDS'; end if;

  select c.school_id,nullif(btrim(c.name),'') into v_school_id,v_grade from public.classes c where c.id=p_class_id;
  if v_school_id is null then raise exception 'SCHEME_CLASS_NOT_FOUND'; end if;
  if v_grade is null then raise exception 'SCHEME_CLASS_GRADE_REQUIRED'; end if;

  if not exists (select 1 from public.teacher_classes tc where tc.teacher_id=v_uid and tc.school_id=v_school_id and tc.class_id=p_class_id and tc.subject_id=p_subject_id) then raise exception 'SCHEME_ASSIGNMENT_REQUIRED'; end if;

  select at.term into v_term from public.academic_terms at where at.id=p_academic_term_id and at.school_id=v_school_id;
  if v_term is null then raise exception 'SCHEME_TERM_NOT_IN_SCHOOL'; end if;

  select case when s.school_id is null then s.id else s.global_subject_id end into v_global_subject_id
  from public.subjects s where s.id=p_subject_id and (s.school_id=v_school_id or s.school_id is null);
  if v_global_subject_id is null then raise exception 'SCHEME_SUBJECT_TAXONOMY_REQUIRED'; end if;

  if exists (
    select 1 from unnest(p_curriculum_ids) x
    left join public.curriculum c on c.id=x and c.global_subject_id=v_global_subject_id and c.grade=v_grade and c.term=v_term
    where c.id is null
  ) then raise exception 'SCHEME_CURRICULUM_IDENTITY_MISMATCH'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_class_id::text||':'||p_subject_id::text||':'||p_academic_term_id::text,0));
  select coalesce(max(s.sequence_number),0)+1 into v_next_sequence from public.scheme_of_work s where s.class_id=p_class_id and s.subject_id=p_subject_id and s.academic_term_id=p_academic_term_id;

  for v_curriculum_id in
    select x from unnest(p_curriculum_ids) x
    join public.curriculum c on c.id=x
    left join public.cbc_strands cs on cs.id=c.sub_strand_id
    order by coalesce(cs.strand_order,2147483647),coalesce(cs.sub_strand_order,2147483647),c.week,c.created_at,c.id
  loop
    select * into v_curr from public.curriculum where id=v_curriculum_id;
    v_content:=null;
    select cc.* into v_content from public.curriculum_content cc
    where cc.curriculum_id=v_curriculum_id and cc.source_type='vibeschool' and cc.status='confirmed'
    order by cc.version desc,cc.updated_at desc nulls last limit 1;
    if v_content.id is null then raise exception 'SCHEME_CANONICAL_CONTENT_REQUIRED:%',v_curriculum_id; end if;

    v_ctx:=coalesce(v_content.lesson_context,'{}'::jsonb);
    select nullif(btrim(string_agg(value,'; ')),'') into v_outcomes from jsonb_array_elements_text(case when jsonb_typeof(v_ctx->'outcomes')='array' then v_ctx->'outcomes' else '[]'::jsonb end);
    v_kiq:=nullif(btrim(coalesce(v_ctx->>'key_inquiry_question',case when jsonb_typeof(v_ctx->'key_inquiry_questions')='array' then (select string_agg(value,'; ') from jsonb_array_elements_text(v_ctx->'key_inquiry_questions')) end,'')),'');
    select nullif(btrim(string_agg(value,'; ')),'') into v_experiences from jsonb_array_elements_text(case when jsonb_typeof(v_ctx->'learning_experiences')='array' then v_ctx->'learning_experiences' else '[]'::jsonb end);
    select nullif(btrim(string_agg(value,'; ')),'') into v_resources from jsonb_array_elements_text(case when jsonb_typeof(v_ctx->'learning_resources')='array' then v_ctx->'learning_resources' else '[]'::jsonb end);
    select nullif(btrim(string_agg(value,'; ')),'') into v_assessment from jsonb_array_elements_text(case when jsonb_typeof(v_ctx->'assessment_methods')='array' then v_ctx->'assessment_methods' else '[]'::jsonb end);
    if v_outcomes is null or v_kiq is null or v_experiences is null or v_resources is null or v_assessment is null then raise exception 'SCHEME_CANONICAL_CONTENT_INCOMPLETE:%',v_curriculum_id; end if;

    if (select count(*) from public.curriculum_content_lesson_versions lv where lv.curriculum_content_id=v_content.id and lv.content_version=v_content.version) <> v_curr.periods then
      raise exception 'SCHEME_LESSON_DECOMPOSITION_REQUIRED:%:expected:%',v_curriculum_id,v_curr.periods;
    end if;

    for v_lesson in
      select * from public.curriculum_content_lesson_versions lv
      where lv.curriculum_content_id=v_content.id and lv.content_version=v_content.version
      order by lv.lesson_number
    loop
      if exists (
        select 1 from public.scheme_of_work s
        where s.class_id=p_class_id and s.subject_id=p_subject_id and s.academic_term_id=p_academic_term_id
          and s.curriculum_id=v_curriculum_id and s.source='curriculum' and s.lesson_number=v_lesson.lesson_number
      ) then continue; end if;

      insert into public.scheme_of_work(
        school_id,teacher_id,class_id,subject_id,curriculum_id,curriculum_content_id,curriculum_content_lesson_version_id,
        academic_term_id,curriculum_type,grade,subject,term,week,strand,sub_strand,
        topic,objectives,key_inquiry_question,learning_experiences,learning_resources,
        assessment_methods,status,source,content_status,sequence_number
      ) values (
        v_school_id,v_uid,p_class_id,p_subject_id,v_curr.id,v_content.id,v_lesson.id,
        p_academic_term_id,'cbc',v_curr.grade,v_curr.subject,v_curr.term,greatest(v_curr.week,1),
        v_curr.strand,v_curr.sub_strand,v_lesson.title,v_outcomes,v_kiq,v_experiences,
        v_resources,v_assessment,'planned','curriculum','complete',v_next_sequence
      ) returning * into v_inserted;

      v_next_sequence:=v_next_sequence+1;
      return next v_inserted;
    end loop;
  end loop;
  return;
end;
$function$;
revoke all on function public.commit_curriculum_scheme(uuid,uuid,uuid,uuid[]) from public,anon;
grant execute on function public.commit_curriculum_scheme(uuid,uuid,uuid,uuid[]) to authenticated;

alter table public.curriculum_content_lesson_versions enable row level security;
revoke all on public.curriculum_content_lesson_versions from public,anon,authenticated; grant select on public.curriculum_content_lesson_versions to authenticated;
drop policy if exists curriculum_content_lesson_versions_read on public.curriculum_content_lesson_versions;
create policy curriculum_content_lesson_versions_read on public.curriculum_content_lesson_versions for select to authenticated using(true);
commit;
