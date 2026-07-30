-- ============================================================================
-- READ-008C — Learner assigned-reading delivery
--
-- Canonical learner identity:
--   auth.uid() = profiles.id = students.profile_id
--
-- Returns only assignments belonging to the authenticated learner's active
-- class memberships and only published VibeTextbook publications/chapters.
-- ============================================================================

create or replace function public.get_my_assigned_reading()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $function$
with viewer as (
  select auth.uid() as viewer_id
),
learner as (
  select s.id as student_id
  from public.students s, viewer v
  where s.profile_id = v.viewer_id
    and s.deleted_at is null
  limit 1
),
items as (
  select
    a.id,
    a.class_id,
    c.name as class_name,
    c.stream as class_stream,
    a.publication_id,
    vp.title as publication_title,
    vp.cover_url,
    vp.cbc_subject,
    vp.cbc_grade,
    a.chapter_id,
    vc.number as chapter_number,
    vc.title as chapter_title,
    a.assigned_at,
    a.due_at,
    coalesce(rp.progress_percent, 0) as progress_percent,
    rp.started_at,
    rp.last_read_at,
    rp.completed_at,
    case
      when rp.completed_at is not null
        or coalesce(rp.progress_percent, 0) >= 100
        then 'completed'
      when coalesce(rp.progress_percent, 0) > 0
        then 'reading'
      else 'not_started'
    end as reading_status,
    case
      when rp.completed_at is not null
        or coalesce(rp.progress_percent, 0) >= 100
        then 'completed'
      when a.due_at is null
        then 'no_due_date'
      when a.due_at < now()
        then 'overdue'
      when a.due_at::date = current_date
        then 'due_today'
      else 'upcoming'
    end as due_status,
    '/read/textbook/'
      || a.publication_id::text
      || '?chapter='
      || a.chapter_id::text as reader_url
  from public.vibe_chapter_assignments a
  join learner l
    on true
  join public.student_classes sc
    on sc.class_id = a.class_id
   and sc.school_id = a.school_id
   and sc.student_id = l.student_id
   and sc.is_current = true
   and sc.left_at is null
  join public.classes c
    on c.id = a.class_id
  join public.vibe_publications vp
    on vp.id = a.publication_id
   and vp.status = 'published'
   and vp.format = 'vibetextbook'
  join public.vibe_chapters vc
    on vc.id = a.chapter_id
   and vc.publication_id = a.publication_id
   and vc.status = 'published'
  left join viewer v
    on true
  left join public.vibe_reading_progress rp
    on rp.viewer_id = v.viewer_id
   and rp.publication_id = a.publication_id
   and rp.chapter_id = a.chapter_id
  where a.status = 'assigned'
)
select jsonb_build_object(
  'ok',
  auth.uid() is not null,
  'reason',
  case
    when auth.uid() is null then 'auth_required'
    else null
  end,
  'items',
  coalesce(
    jsonb_agg(
      to_jsonb(items.*)
      order by items.due_at nulls last, items.assigned_at desc
    ),
    '[]'::jsonb
  )
)
from items;
$function$;

revoke all
on function public.get_my_assigned_reading()
from public, anon;

grant execute
on function public.get_my_assigned_reading()
to authenticated, service_role;
