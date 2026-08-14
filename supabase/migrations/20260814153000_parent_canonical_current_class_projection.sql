begin;

-- Parent projections must use the canonical student_classes relationship rather than the legacy students.class_id field.
-- This keeps parent identity, class membership, attendance context and school context aligned after learner transfers.

create or replace function public.get_parent_dashboard()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); payload jsonb;
begin
 if caller is null then raise exception 'Authentication required'; end if;
 if not exists (select 1 from public.profiles p where p.id=caller and p.role='parent') then raise exception 'Parent access required'; end if;
 select jsonb_build_object(
  'children', coalesce((select jsonb_agg(x order by child_name) from (
    select distinct on (s.id) s.id child_id,s.name child_name,
      coalesce(c.name || case when c.stream is not null then ' '||c.stream else '' end,'Class not assigned') class_name,
      coalesce(sc.name,'School not assigned') school_name,
      coalesce(att.recorded_count,0) attendance_recorded,att.attendance_pct,
      case when s.deleted_at is not null then 'unavailable' when cur.class_id is null then 'waiting' when coalesce(att.recorded_count,0)<5 then 'insufficient_data' when att.attendance_pct<80 then 'needs_attention' else 'attendance_on_track' end status,
      case when s.deleted_at is not null then 'No longer available' when cur.class_id is null then 'Waiting for school' when coalesce(att.recorded_count,0)<5 then 'Not enough recent data' when att.attendance_pct<80 then 'Attendance needs attention' else 'Attendance on track' end status_label
    from public.parent_student_links psl join public.students s on s.id=psl.student_id
    left join lateral (select sc.class_id,sc.school_id from public.student_classes sc where sc.student_id=s.id and sc.is_current=true order by sc.joined_at desc nulls last limit 1) cur on true
    left join public.classes c on c.id=cur.class_id left join public.schools sc on sc.id=cur.school_id
    left join lateral (select count(*)::int recorded_count,round(100.0*count(*) filter(where a.status='present')/nullif(count(*),0))::int attendance_pct from public.attendance a where a.student_id=s.id and a.date>=current_date-30) att on true
    where psl.parent_id=caller and coalesce(psl.access_level,'full')<>'none'
    order by s.id,psl.updated_at desc nulls last,psl.created_at desc nulls last
  ) x),'[]'::jsonb),
  'attention', coalesce((select jsonb_agg(item order by priority,child_name) from (
    select distinct on(s.id) 1 priority,s.name child_name,jsonb_build_object('type','attendance','student_id',s.id,'title',s.name||'''s attendance needs attention','detail',att.attendance_pct||'% attendance recorded in the last 30 days') item
    from public.parent_student_links psl join public.students s on s.id=psl.student_id
    left join lateral(select sc.class_id from public.student_classes sc where sc.student_id=s.id and sc.is_current=true order by sc.joined_at desc nulls last limit 1) cur on true
    cross join lateral(select count(*)::int recorded_count,round(100.0*count(*) filter(where a.status='present')/nullif(count(*),0))::int attendance_pct from public.attendance a where a.student_id=s.id and a.date>=current_date-30) att
    where psl.parent_id=caller and coalesce(psl.access_level,'full')<>'none' and s.deleted_at is null and cur.class_id is not null and att.recorded_count>=5 and att.attendance_pct<80
    order by s.id,psl.updated_at desc nulls last,psl.created_at desc nulls last
  ) y),'[]'::jsonb)
 ) into payload; return payload;
end; $$;

create or replace function public.get_parent_child_dashboard(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
 if caller is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.parent_student_links psl where psl.parent_id=caller and psl.student_id=p_student_id and coalesce(psl.access_level,'full')<>'none') then raise exception 'Child access not authorized'; end if;
 select jsonb_build_object('child',jsonb_build_object('id',s.id,'name',s.name,'class_name',coalesce(c.name||case when c.stream is not null then ' '||c.stream else '' end,'Class not assigned'),'school_name',coalesce(sc.name,'School not assigned')),
 'today_attendance',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'date',a.date) order by a.id) from public.attendance a where a.student_id=s.id and a.date=current_date),'[]'::jsonb),
 'attendance',(select jsonb_build_object('recorded',count(*)::int,'present',count(*) filter(where a.status='present')::int,'percentage',case when count(*)=0 then null else round(100.0*count(*) filter(where a.status='present')/count(*))::int end) from public.attendance a where a.student_id=s.id and a.date>=current_date-30),
 'mastery',coalesce((select jsonb_agg(jsonb_build_object('subject_id',x.subject_id,'subject',coalesce(sub.name,'Subject'),'mastered',x.mastered,'assessed',x.assessed,'total',x.total) order by sub.name) from (select lo.subject_id,count(*)::int total,count(*) filter(where lo.status='mastered')::int mastered,count(*) filter(where lo.status in('mastered','assessed'))::int assessed from public.learner_outcomes lo where lo.student_id=s.id and lo.subject_id is not null group by lo.subject_id)x left join public.subjects sub on sub.id=x.subject_id),'[]'::jsonb)) into result
 from public.students s left join lateral(select sc.class_id,sc.school_id from public.student_classes sc where sc.student_id=s.id and sc.is_current=true order by sc.joined_at desc nulls last limit 1) cur on true left join public.classes c on c.id=cur.class_id left join public.schools sc on sc.id=cur.school_id where s.id=p_student_id;
 if result is null then raise exception 'Child not found'; end if; return result;
end; $$;

commit;
