begin;

-- Publication is a data invariant, not a convention. A course is publicly
-- discoverable only when it is live and has at least one module containing
-- at least one published topic. Normalize any existing invalid live rows first.
update public.courses c
set status = 'coming_soon',
    modules_count = 0
where c.status = 'live'
  and not exists (
    select 1
    from public.modules m
    join public.topics t on t.module_id = m.id
    where m.course_id = c.id
      and t.content_status = 'published'
  );

create or replace function public.assert_course_publication_ready()
returns trigger
language plpgsql
as $$
declare
  v_course_id uuid;
  v_course_ids uuid[] := array[]::uuid[];
begin
  if tg_table_name = 'courses' then
    if tg_op <> 'DELETE' then
      v_course_ids := array_append(v_course_ids, new.id);
    end if;
    if tg_op <> 'INSERT' then
      v_course_ids := array_append(v_course_ids, old.id);
    end if;
  elsif tg_table_name = 'modules' then
    if tg_op <> 'DELETE' then
      v_course_ids := array_append(v_course_ids, new.course_id);
    end if;
    if tg_op <> 'INSERT' then
      v_course_ids := array_append(v_course_ids, old.course_id);
    end if;
  elsif tg_table_name = 'topics' then
    if tg_op <> 'DELETE' then
      select m.course_id into v_course_id
      from public.modules m
      where m.id = new.module_id;
      v_course_ids := array_append(v_course_ids, v_course_id);
    end if;
    if tg_op <> 'INSERT' then
      select m.course_id into v_course_id
      from public.modules m
      where m.id = old.module_id;
      v_course_ids := array_append(v_course_ids, v_course_id);
    end if;
  end if;

  foreach v_course_id in array v_course_ids loop
    if v_course_id is not null
       and exists (
         select 1 from public.courses c
         where c.id = v_course_id and c.status = 'live'
       )
       and not exists (
         select 1
         from public.modules m
         join public.topics t on t.module_id = m.id
         where m.course_id = v_course_id
           and t.content_status = 'published'
       ) then
      raise exception using
        errcode = '23514',
        message = 'Course publication invariant violated',
        detail = 'A live course must contain at least one module with at least one published topic.';
    end if;
  end loop;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_courses_publication_ready on public.courses;
create constraint trigger trg_courses_publication_ready
  after insert or update of status or delete on public.courses
  deferrable initially deferred
  for each row execute function public.assert_course_publication_ready();

drop trigger if exists trg_modules_publication_ready on public.modules;
create constraint trigger trg_modules_publication_ready
  after insert or update or delete on public.modules
  deferrable initially deferred
  for each row execute function public.assert_course_publication_ready();

drop trigger if exists trg_topics_publication_ready on public.topics;
create constraint trigger trg_topics_publication_ready
  after insert or update of module_id, content_status or delete on public.topics
  deferrable initially deferred
  for each row execute function public.assert_course_publication_ready();

commit;
