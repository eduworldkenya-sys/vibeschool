-- Correct the deployed Grade 4 Mathematics Time reader contract.
-- cbc_strands.source_ref is nullable: the authoritative source_ref is stored
-- in grade4_mathematics_reader_bindings (the joined, active grade + subject map).
-- The previous function returned unit_id=NULL for every certified lesson;
-- the browser correctly rejected those rows, falsely showing "unpublished".
-- This is a read-only contract repair; keep all certification/RLS predicates.
-- Grade 4 Mathematics, Measurement 2.6 Time.
-- Shared read-only access to existing certified Content Engine resource versions.
-- Never exposes candidate, unverified or teacher-private drafts.
begin;

create or replace function public.vs_public_grade4_math_time_learner_lessons()
returns table (
 resource_version_id uuid, title text, unit_id text,
 asset_kind text, body text, lesson_order integer
)
language sql stable security definer set search_path = ''
as $reader$
  select
    v.id,
    r.title::text,
    split_part(b.source_ref, '#', 2)::text,
    r.asset_kind::text,
    coalesce(nullif(v.payload->>'content_text', ''), nullif(v.payload->>'body', ''))::text,
    case when r.canonical_key ~ ':lesson:[0-9]{2}$'
      then substring(r.canonical_key from ':lesson:([0-9]{2})$')::integer
      else 0 end
  from public.learning_resources r
  join public.learning_resource_versions v on v.resource_id = r.id
  join public.cbc_strands s on s.id = r.sub_strand_id
  join public.grade4_mathematics_reader_bindings b
    on b.sub_strand_id = s.id and b.status = 'active'
  where r.owner_type = 'platform'
    and r.source_type = 'platform_authored'
    and r.grade = 'Grade 4'
    and r.subject = 'Mathematics'
    and r.sub_strand_id is not null
    and s.grade = 'Grade 4'
    and s.name = 'Measurement'
    and s.sub_strand = 'Time'
    and b.source_ref = 'VS-CUR-G04-MA-2026#2.6'
    and r.status = 'active'
    and r.visibility = 'public'
    and r.asset_kind = 'learner_notes'
    and r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%'
    and v.lifecycle_status = 'certified'
    and v.certified_at is not null
    and v.rights_status in ('cleared', 'not_applicable')
    and v.payload->>'source_edition' = 'learner'
    and v.payload->>'schema' = 'vibeschool.originals.lesson-content.v1'
    and length(coalesce(v.payload->>'content_text', v.payload->>'body', '')) > 0
    and public.fn_learning_resource_visible(r.id)
  order by 6, r.canonical_key
  limit 20;
$reader$;

revoke all on function public.vs_public_grade4_math_time_learner_lessons()
  from public, anon, authenticated;
grant execute on function public.vs_public_grade4_math_time_learner_lessons()
  to anon, authenticated;

comment on function public.vs_public_grade4_math_time_learner_lessons() is
  'Read-only learner delivery for certified Grade 4 Mathematics Time originals, never candidate versions.';
-- Exercise the precise reader contract consumed by Grade4TimeContentReader.
do $audit$
declare v_all integer; v_valid integer;
begin
  select count(*),count(*) filter (
    where unit_id='2.6' and lesson_order between 1 and 10
      and resource_version_id is not null and title<>'' and length(body)>100
  ) into v_all,v_valid
  from public.vs_public_grade4_math_time_learner_lessons();
  if v_all<>10 or v_valid<>10 then
    raise exception 'GRADE4_TIME_READER_BAD_UNIT_ID_OR_INCOMPLETE_LESSONS: % / %',v_valid,v_all;
  end if;
end
$audit$;
commit;
