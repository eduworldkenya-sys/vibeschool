-- VibeSchool Task 6: every child-scoped parent notification must navigate to a
-- valid surface that is unambiguously scoped to the authorized learner.
-- authorization-test: public.parent_events

begin;

create or replace function private.parent_event_normalize_action_href()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.student_id is null then
    return new;
  end if;

  -- Legacy report-card route does not exist in the Parent app. The Learn page
  -- currently has a family selector but does not consume studentId query params,
  -- so child-scoped learning notifications also land on the canonical child hub
  -- rather than risking a different sibling being shown.
  if new.action_href is null
     or new.action_href like '/parent/report-cards%'
     or new.action_href like '/parent/learn?studentId=%' then
    new.action_href := '/parent/child/' || new.student_id::text;
  end if;

  return new;
end;
$function$;

revoke all on function private.parent_event_normalize_action_href() from public, anon, authenticated;
grant execute on function private.parent_event_normalize_action_href() to service_role;

drop trigger if exists trg_parent_event_normalize_action_href on public.parent_events;
create trigger trg_parent_event_normalize_action_href
before insert or update of student_id, action_href on public.parent_events
for each row execute function private.parent_event_normalize_action_href();

update public.parent_events
set action_href = '/parent/child/' || student_id::text
where student_id is not null
  and (
    action_href is null
    or action_href like '/parent/report-cards%'
    or action_href like '/parent/learn?studentId=%'
  );

commit;
