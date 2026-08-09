create table if not exists public.publication_release_checks (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  chapter_id uuid references public.vibe_chapters(id) on delete cascade,
  check_code text not null,
  status text not null check (status in ('pass','fail','warn')),
  score numeric not null default 0,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  unique(publication_id,chapter_id,check_code)
);

alter table public.publication_release_checks enable row level security;
revoke all on table public.publication_release_checks from anon;
grant select,insert,update,delete on table public.publication_release_checks to authenticated;

drop policy if exists publication_release_checks_hq on public.publication_release_checks;
create policy publication_release_checks_hq
  on public.publication_release_checks
  for all
  to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

create or replace function public.hq_run_publication_release_check(p_publication_id uuid)
returns table(check_code text,status text,score numeric,details jsonb)
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  ch record;
  wc int;
  bc int;
  oc int;
  rc int;
  td int;
  ib int;
  ab int;
  ai int;
  expected_interactive boolean;
begin
  if not public.is_platform_owner() then
    raise exception 'HQ platform owner required';
  end if;

  delete from public.publication_release_checks
  where publication_id=p_publication_id;

  for ch in
    select * from public.vibe_chapters
    where publication_id=p_publication_id
    order by number
  loop
    wc:=coalesce(ch.word_count,0);

    select count(*),
           count(*) filter(where block_type='interactive'),
           count(*) filter(where is_assessable)
    into bc,ib,ab
    from public.content_blocks
    where chapter_id=ch.id;

    select count(*) into oc
    from public.curriculum_learning_outcomes
    where curriculum_id=ch.curriculum_id
      and status='active'
      and source_type='official';

    select count(*) into rc
    from public.learning_resources
    where chapter_id=ch.id;

    select count(*) into td
    from public.content_derivatives
    where source_chapter_id=ch.id
      and audience='teacher';

    select count(*) into ai
    from public.generated_assessment_items gai
    join public.generated_assessments ga on ga.id=gai.assessment_id
    join public.content_assessment_blueprints b on b.id=ga.blueprint_id
    where b.title ilike '%'||ch.title||'%';

    expected_interactive := ch.number in (3,4,5,6,7);

    insert into public.publication_release_checks(publication_id,chapter_id,check_code,status,score,details)
    values
      (p_publication_id,ch.id,'depth',case when wc>=1200 then 'pass' when wc>=900 then 'warn' else 'fail' end,least(100,wc/12.0),jsonb_build_object('word_count',wc,'target',1200)),
      (p_publication_id,ch.id,'curriculum_outcomes',case when oc>0 then 'pass' else 'fail' end,case when oc>0 then 100 else 0 end,jsonb_build_object('official_active_outcomes',oc)),
      (p_publication_id,ch.id,'canonical_resource',case when rc>0 then 'pass' else 'fail' end,case when rc>0 then 100 else 0 end,jsonb_build_object('resources',rc)),
      (p_publication_id,ch.id,'teacher_guide',case when td>0 then 'pass' else 'fail' end,case when td>0 then 100 else 0 end,jsonb_build_object('teacher_derivatives',td)),
      (p_publication_id,ch.id,'assessment',case when ai>=6 then 'pass' when ai>=3 then 'warn' else 'fail' end,least(100,ai*100.0/6),jsonb_build_object('formal_items',ai,'target',6)),
      (p_publication_id,ch.id,'interactive',case when expected_interactive and ib=0 then 'fail' when ib>0 then 'pass' else 'warn' end,case when ib>0 then 100 when expected_interactive then 0 else 70 end,jsonb_build_object('interactive_blocks',ib,'expected',expected_interactive)),
      (p_publication_id,ch.id,'assessable_blocks',case when ab>=2 then 'pass' else 'fail' end,least(100,ab*50.0),jsonb_build_object('assessable_blocks',ab,'target',2));
  end loop;

  return query
    select prc.check_code,prc.status,prc.score,prc.details
    from public.publication_release_checks prc
    where prc.publication_id=p_publication_id
    order by prc.chapter_id,prc.check_code;
end;
$$;

revoke all on function public.hq_run_publication_release_check(uuid) from public,anon;
grant execute on function public.hq_run_publication_release_check(uuid) to authenticated;
