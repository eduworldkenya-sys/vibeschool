-- Preserve the selected KICD-aligned English teaching theme in the
-- canonical Scheme lesson title while retaining sub-strand/outcome IDs.
-- Uses the existing authorized Grade 1 mapped Scheme writer inside the
-- same transaction; no direct frontend updates, no duplicate Scheme engine.
begin;

create or replace function public.commit_mapped_thematic_scheme_lesson(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_week integer,
  p_sub_strand_id uuid,
  p_outcome_ids uuid[],
  p_theme_id integer
) returns public.scheme_of_work
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_themes constant text[] := array['Greetings', 'School', 'Family', 'Home', 'Time', 'Weather and Our Environment', 'Hygiene', 'Parts of the Body', 'My Friends', 'Safety', 'Community Leaders', 'Living Together', 'Technology', 'Numbers', 'Conserving Resources'];
  v_saved public.scheme_of_work%rowtype;
  v_updated public.scheme_of_work%rowtype;
begin
  if auth.uid() is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  if p_theme_id is null or p_theme_id not between 1 and array_length(v_themes,1) then
    raise exception 'SCHEME_ENGLISH_THEME_REQUIRED';
  end if;
  -- The inner writer validates the assignment, class/subject identity,
  -- actual instructional week, weekly allocation and every outcome FK.
  v_saved:=public.commit_mapped_scheme_lesson(
    p_class_id,p_subject_id,p_academic_term_id,p_week,p_sub_strand_id,p_outcome_ids);
  if v_saved.id is null or v_saved.reference not like 'VS-CUR-G01-EN-2026#%' then
    raise exception 'SCHEME_ENGLISH_THEME_SUBJECT_MISMATCH';
  end if;

  update public.scheme_of_work sw
  set topic=v_themes[p_theme_id]||' · '||v_saved.topic
  where sw.id=v_saved.id and sw.teacher_id=auth.uid()
  returning * into v_updated;
  if v_updated.id is null then raise exception 'SCHEME_ENGLISH_THEME_LINK_FAILED'; end if;
  return v_updated;
end;
$function$;
revoke all on function public.commit_mapped_thematic_scheme_lesson(
  uuid,uuid,uuid,integer,uuid,uuid[],integer) from public,anon;
grant execute on function public.commit_mapped_thematic_scheme_lesson(
  uuid,uuid,uuid,integer,uuid,uuid[],integer) to authenticated;

commit;
