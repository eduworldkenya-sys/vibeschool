create function public.commit_grade4_time_scheme_lesson(
  p_class_id uuid, p_subject_id uuid, p_academic_term_id uuid, p_week integer,
  p_sub_strand_id uuid, p_outcome_ids uuid[], p_content_lesson integer
)
returns public.scheme_of_work
language plpgsql security invoker set search_path = ''
as $$
declare
  v_resource_id uuid;
  v_scheme public.scheme_of_work;
  v_link jsonb;
begin
  if p_content_lesson is null or p_content_lesson not between 1 and 10 then
    raise exception 'INVALID_TIME_LESSON_NUMBER';
  end if;

  select r.id into strict v_resource_id
  from public.learning_resources r
  join public.grade4_mathematics_reader_bindings b on b.sub_strand_id = r.sub_strand_id
  where b.source_ref = 'VS-CUR-G04-MA-2026#2.6' and b.status = 'active'
    and r.sub_strand_id = p_sub_strand_id
    and r.canonical_key = 'vs:g4:mathematics:time:learner:lesson:' || lpad(p_content_lesson::text, 2, '0')
    and r.status = 'active' and r.owner_type = 'platform'
    and exists (
      select 1 from public.learning_resource_versions v
      where v.resource_id = r.id and v.lifecycle_status = 'certified'
        and v.certified_at is not null and v.rights_status in ('cleared', 'not_applicable')
    );

  v_scheme := public.commit_mapped_scheme_lesson(
    p_class_id, p_subject_id, p_academic_term_id, p_week, p_sub_strand_id, p_outcome_ids
  );
  v_link := public.link_learning_resource(v_resource_id, 'scheme_lesson', v_scheme.id, 'source');
  if (v_link->>'ok') is distinct from 'true' then
    raise exception 'TIME_SCHEME_RESOURCE_LINK_FAILED';
  end if;
  return v_scheme;
end;
$$;

revoke all on function public.commit_grade4_time_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[],integer) from public, anon;
grant execute on function public.commit_grade4_time_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[],integer) to authenticated;
