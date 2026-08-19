-- HQ Schools Network OS explorer + attention read models.

create or replace function public.hq_school_network_explorer(
  p_state text default 'canonical',p_county text default null,p_query text default null,
  p_days integer default 30,p_offset integer default 0,p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_state text:=lower(coalesce(nullif(trim(p_state),''),'canonical'));
  v_county text:=nullif(trim(p_county),'');
  v_query text:=lower(nullif(trim(p_query),''));
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_offset integer:=greatest(0,coalesce(p_offset,0));
  v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  perform public.hq_assert_owner();
  if v_state not in ('known','canonical','connected','active') then raise exception 'invalid_school_network_state'; end if;

  if v_state='known' then
    return (
      with base as (
        select d.id,d.name,d.county,d.sub_county,d.knec_code,'DIRECTORY'::text source,
               null::int linked_users,null::int active_users
        from public.schools_directory d
        where lower(coalesce(d.status,'active'))<>'closed'
          and (v_county is null or lower(trim(coalesce(d.county,'')))=lower(v_county))
          and (v_query is null or lower(d.name) like '%'||v_query||'%' or lower(coalesce(d.knec_code,''))=v_query)
      ), page as (
        select * from base order by name,id offset v_offset limit v_limit
      )
      select jsonb_build_object('state',v_state,'total',(select count(*)::int from base),'offset',v_offset,'limit',v_limit,
        'rows',coalesce((select jsonb_agg(to_jsonb(page) order by name,id) from page),'[]'::jsonb),'generated_at',clock_timestamp())
    );
  end if;

  return (
    with base as (
      select s.id,s.name,s.county,s.sub_county,s.knec_code,'CANONICAL'::text source,
             (select count(distinct sm.profile_id)::int from public.school_members sm where sm.school_id=s.id) linked_users,
             (select count(distinct pe.actor_id)::int from public.platform_events pe where pe.school_id=s.id and pe.actor_id is not null and pe.occurred_at>=clock_timestamp()-make_interval(days=>v_days)) active_users,
             exists(select 1 from public.school_members sm where sm.school_id=s.id) connected,
             exists(select 1 from public.platform_events pe where pe.school_id=s.id and pe.occurred_at>=clock_timestamp()-make_interval(days=>v_days)) active
      from public.schools s
      where s.deleted_at is null
        and (v_county is null or lower(trim(coalesce(s.county,'')))=lower(v_county))
        and (v_query is null or lower(s.name) like '%'||v_query||'%' or lower(coalesce(s.knec_code,''))=v_query or lower(coalesce(s.nemis_code,''))=v_query)
    ), filtered as (
      select id,name,county,sub_county,knec_code,source,linked_users,active_users
      from base where v_state='canonical' or (v_state='connected' and connected) or (v_state='active' and connected and active)
    ), page as (select * from filtered order by name,id offset v_offset limit v_limit)
    select jsonb_build_object('state',v_state,'total',(select count(*)::int from filtered),'offset',v_offset,'limit',v_limit,
      'rows',coalesce((select jsonb_agg(to_jsonb(page) order by name,id) from page),'[]'::jsonb),'generated_at',clock_timestamp())
  );
end;
$$;
revoke all on function public.hq_school_network_explorer(text,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.hq_school_network_explorer(text,text,text,integer,integer,integer) to authenticated;

create or replace function public.hq_school_network_attention(p_county text default null,p_days integer default 30,p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_county text:=nullif(trim(p_county),'');
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  perform public.hq_assert_owner();
  return (
    with school_evidence as (
      select s.id,s.name,s.county,
        (select count(distinct sc.student_id)::int from public.student_classes sc where sc.school_id=s.id and sc.is_current) learners,
        (select count(distinct tc.teacher_id)::int from public.teacher_classes tc where tc.school_id=s.id) teachers,
        (select count(*)::int from public.attendance a where a.school_id=s.id and a.date>=current_date-(least(v_days,7)-1)) attendance_marks,
        (select count(*)::int from public.homework h where h.school_id=s.id and h.created_at>=clock_timestamp()-make_interval(days=>least(v_days,7))) homework_created,
        (select count(*)::int from public.hq_support_cases sc where sc.school_id=s.id and sc.status not in ('resolved','closed')) open_support,
        (select max(pe.occurred_at) from public.platform_events pe where pe.school_id=s.id) last_activity
      from public.schools s
      where s.deleted_at is null and (v_county is null or lower(trim(coalesce(s.county,'')))=lower(v_county))
    ), signals as (
      select *,array_remove(array[
        case when learners>0 and teachers=0 then 'learners_without_teacher_assignment' end,
        case when learners>0 and attendance_marks=0 then 'no_attendance_evidence_7d' end,
        case when learners>0 and homework_created=0 then 'no_homework_created_7d' end,
        case when open_support>0 then 'open_support_cases' end,
        case when last_activity is not null and last_activity<clock_timestamp()-make_interval(days=>v_days) then 'inactive_in_selected_window' end
      ],null) reasons
      from school_evidence
    ), ranked as (
      select id school_id,name school_name,county,reasons,cardinality(reasons)::int signal_count,last_activity,open_support
      from signals where cardinality(reasons)>0
      order by cardinality(reasons) desc,open_support desc,name
      limit v_limit
    )
    select jsonb_build_object('county',v_county,'window_days',v_days,'items',coalesce((select jsonb_agg(to_jsonb(ranked) order by signal_count desc,school_name) from ranked),'[]'::jsonb),'generated_at',clock_timestamp())
  );
end;
$$;
revoke all on function public.hq_school_network_attention(text,integer,integer) from public, anon, authenticated;
grant execute on function public.hq_school_network_attention(text,integer,integer) to authenticated;
