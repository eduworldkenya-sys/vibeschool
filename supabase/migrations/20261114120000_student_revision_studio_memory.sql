-- VibeSchool Revision Studio: learner-owned spaced recall, independent of formal exam marking.
create table if not exists public.student_revision_memory (
  student_id uuid not null references public.profiles(id) on delete cascade,
  mistake_id uuid not null references public.student_mistake_notebook(id) on delete cascade,
  recall_count integer not null default 0 check (recall_count >= 0),
  interval_days integer not null default 1 check (interval_days between 1 and 60),
  last_remembered boolean,
  last_recalled_at timestamptz,
  next_review_at timestamptz not null default now(),
  primary key (student_id, mistake_id)
);

create index if not exists student_revision_memory_due_idx
  on public.student_revision_memory (student_id, next_review_at);
alter table public.student_revision_memory enable row level security;
drop policy if exists student_revision_memory_select_own on public.student_revision_memory;
create policy student_revision_memory_select_own on public.student_revision_memory
  for select to authenticated using (student_id = auth.uid());

create or replace function public.student_record_revision_recall(
  p_mistake_id uuid, p_remembered boolean
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_student uuid := auth.uid();
  v_existing public.student_revision_memory%rowtype;
  v_interval integer;
  v_due timestamptz;
begin
  if v_student is null then raise exception 'Authentication required'; end if;
  if p_mistake_id is null or p_remembered is null then raise exception 'Recall answer is required'; end if;
  if not exists (
    select 1 from public.student_mistake_notebook m
    where m.id = p_mistake_id and m.student_id = v_student
  ) then raise exception 'Revision item not found'; end if;

  -- Serialize repeated submissions for a single item to avoid conflicting intervals.
  perform pg_advisory_xact_lock(hashtextextended(v_student::text || ':' || p_mistake_id::text, 0));
  select * into v_existing from public.student_revision_memory
    where student_id = v_student and mistake_id = p_mistake_id;
  v_interval := case
    when not p_remembered then 1
    when v_existing.recall_count is null or v_existing.recall_count = 0 then 3
    else least(60, greatest(3,v_existing.interval_days * 2))
  end;
  v_due := now() + make_interval(days => v_interval);

  insert into public.student_revision_memory
    (student_id,mistake_id,recall_count,interval_days,last_remembered,last_recalled_at,next_review_at)
  values (v_student,p_mistake_id,1,v_interval,p_remembered,now(),v_due)
  on conflict (student_id,mistake_id) do update set
    recall_count = public.student_revision_memory.recall_count + 1,
    interval_days = excluded.interval_days,
    last_remembered = excluded.last_remembered,
    last_recalled_at = excluded.last_recalled_at,
    next_review_at = excluded.next_review_at;
  return jsonb_build_object('recorded',true,'next_review_at',v_due,'interval_days',v_interval);
end $$;

revoke all on function public.student_record_revision_recall(uuid,boolean) from public,anon;
grant execute on function public.student_record_revision_recall(uuid,boolean) to authenticated;
