-- Recovered from the authoritative production Supabase migration ledger for L0 replay parity.
create table if not exists public.hq_departments (
  key text primary key,
  name text not null,
  mandate text not null,
  icon text,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.hq_departments(key,name,mandate,icon,sort_order) values
('executive','Executive','Decisions, priorities, approvals and company direction','boardroom',10),
('finance','Finance','Revenue, expenses, receivables, reconciliations and controls','finance',20),
('technology','Technology & Security','Platform health, incidents, releases, security and reliability','technology',30),
('operations','Operations','School operations, teaching throughput, service levels and bottlenecks','operations',40),
('product','Product','Feature adoption, funnels, retention, quality and user friction','product',50),
('growth','Growth & Sales','Acquisition, activation, leads, partnerships and conversion','growth',60),
('customer','Customer Success & Support','Onboarding, support, communication, retention and escalations','support',70),
('content','Content & Curriculum','Curriculum coverage, publishing, VibeLabs, editorial and moderation','content',80),
('people','People Operations','Staff access, responsibilities, onboarding, leave and performance workflows','people',90),
('trust','Legal, Risk & Compliance','Privacy, consent, contracts, safeguarding, audit and risk','trust',100),
('marketing','Marketing & Communications','Campaigns, brand, announcements, PR and communication calendar','marketing',110),
('procurement','Procurement & Vendors','Vendors, purchases, renewals, contracts and service costs','procurement',120),
('programs','Programs & Projects','Initiatives, milestones, dependencies, blocked work and delivery','programs',130),
('data','Data & BI','Metric definitions, analytics, cohorts, forecasts and reporting','data',140),
('quality','Quality & Release','Regression, release readiness, defects and content quality','quality',150),
('knowledge','Knowledge & SOP','Policies, SOPs, company memory and operating documentation','knowledge',160)
on conflict(key) do update set name=excluded.name,mandate=excluded.mandate,icon=excluded.icon,sort_order=excluded.sort_order;

create table if not exists public.hq_work_items (
  id uuid primary key default gen_random_uuid(),
  department_key text not null references public.hq_departments(key),
  work_type text not null,
  priority text not null default 'normal' check(priority in('low','normal','high','critical')),
  status text not null default 'open' check(status in('open','in_progress','waiting_approval','resolved','cancelled')),
  title text not null,
  summary text,
  source_type text,
  source_id uuid,
  route text,
  approval_required boolean not null default false,
  due_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists hq_work_items_department_status_idx on public.hq_work_items(department_key,status,priority,created_at desc);

alter table public.hq_departments enable row level security;
alter table public.hq_work_items enable row level security;
revoke all on public.hq_departments,public.hq_work_items from anon,authenticated;
do $$ begin create policy hq_departments_owner_select on public.hq_departments for select to authenticated using ((select public.is_platform_owner())); exception when duplicate_object then null; end $$;
do $$ begin create policy hq_work_items_owner_select on public.hq_work_items for select to authenticated using ((select public.is_platform_owner())); exception when duplicate_object then null; end $$;

do $$ begin create policy hq_platform_events_owner_select on public.platform_events for select to authenticated using ((select public.is_platform_owner())); exception when duplicate_object then null; end $$;
do $$ begin create policy hq_notifications_owner_select on public.hq_notifications for select to authenticated using ((select public.is_platform_owner())); exception when duplicate_object then null; end $$;
do $$ begin create policy hq_incidents_owner_select on public.hq_incidents for select to authenticated using ((select public.is_platform_owner())); exception when duplicate_object then null; end $$;

create or replace function public.hq_route_work_items()
returns integer language plpgsql security definer set search_path=public as $$
declare total_count int:=0; added_count int:=0; begin
 perform public.hq_assert_owner();
 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,evidence)
 select case
   when i.incident_type ilike '%security%' or i.incident_type ilike '%auth%' then 'technology'
   when i.incident_type ilike '%config%' then 'technology'
   when i.incident_type ilike '%mark%' or i.incident_type ilike '%lesson%' then 'operations'
   else 'executive' end,
   'incident',case when i.severity='critical' then 'critical' else 'high' end,'open',i.title,i.summary,'incident',i.id,i.route,false,i.evidence
 from public.hq_incidents i
 where i.status<>'resolved' and not exists(select 1 from public.hq_work_items w where w.source_type='incident' and w.source_id=i.id);
 get diagnostics added_count=row_count; total_count:=total_count+added_count;

 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,evidence)
 select case hn.category when 'content' then 'content' when 'finance' then 'finance' when 'security' then 'technology' when 'teaching' then 'operations' else 'customer' end,
 'notification',case when hn.severity='critical' then 'critical' when hn.severity='warning' then 'high' else 'normal' end,'open',hn.title,hn.body,'notification',hn.id,hn.route,false,hn.metadata
 from public.hq_notifications hn
 where hn.status<>'resolved' and hn.severity in('warning','critical') and not exists(select 1 from public.hq_work_items w where w.source_type='notification' and w.source_id=hn.id);
 get diagnostics added_count=row_count; total_count:=total_count+added_count;
 return total_count;
end $$;

create or replace function public.hq_list_departments()
returns table(key text,name text,mandate text,icon text,open_count bigint,critical_count bigint,waiting_approval_count bigint)
language plpgsql security definer set search_path=public as $$ begin
 perform public.hq_assert_owner(); perform public.hq_route_work_items();
 return query select d.key,d.name,d.mandate,d.icon,
 count(w.id) filter(where w.status in('open','in_progress','waiting_approval')),
 count(w.id) filter(where w.status in('open','in_progress','waiting_approval') and w.priority='critical'),
 count(w.id) filter(where w.status='waiting_approval')
 from public.hq_departments d left join public.hq_work_items w on w.department_key=d.key
 where d.active group by d.key,d.name,d.mandate,d.icon,d.sort_order order by d.sort_order;
end $$;

create or replace function public.hq_list_work_items(p_department text default null,p_limit int default 100)
returns setof public.hq_work_items language plpgsql security definer set search_path=public as $$ begin
 perform public.hq_assert_owner(); perform public.hq_route_work_items();
 return query select * from public.hq_work_items where (p_department is null or department_key=p_department)
 order by case priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,created_at desc
 limit greatest(1,least(coalesce(p_limit,100),500));
end $$;

create or replace function public.hq_update_work_item(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$ begin
 perform public.hq_assert_owner();
 if p_status not in('open','in_progress','waiting_approval','resolved','cancelled') then raise exception 'Invalid status'; end if;
 update public.hq_work_items set status=p_status,updated_at=now(),resolved_at=case when p_status='resolved' then now() else resolved_at end where id=p_id;
end $$;

create or replace function public.hq_get_morning_brief()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;begin
 perform public.hq_assert_owner(); perform public.hq_activate_due_decisions(); perform public.hq_route_work_items();
 select jsonb_build_object(
 'generated_at',now(),
 'headline',jsonb_build_object(
   'new_users_today',(select count(*) from public.profiles where created_at>=date_trunc('day',now())),
   'active_schools',(select count(*) from public.schools where deleted_at is null and status::text='active'),
   'lesson_plans_today',(select count(*) from public.lesson_plans where created_at>=date_trunc('day',now())),
   'submissions_today',(select count(*) from public.homework_submissions where submitted_at>=date_trunc('day',now())),
   'open_incidents',(select count(*) from public.hq_incidents where status<>'resolved'),
   'decisions_waiting',(select count(*) from public.hq_decisions where status in('draft','reviewed','approved')),
   'work_waiting_approval',(select count(*) from public.hq_work_items where status='waiting_approval')
 ),
 'priorities',coalesce((select jsonb_agg(x) from (select jsonb_build_object('department',department_key,'priority',priority,'title',title,'summary',summary,'route',route) x from public.hq_work_items where status in('open','in_progress','waiting_approval') order by case priority when 'critical' then 1 when 'high' then 2 else 3 end,created_at desc limit 7) q),'[]'::jsonb),
 'decisions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'title',title,'status',status)) from (select * from public.hq_decisions where status in('draft','reviewed','approved','locked') order by created_at desc limit 5) d),'[]'::jsonb)
 ) into v;
 return v;
end $$;

revoke all on function public.hq_route_work_items(),public.hq_list_departments(),public.hq_list_work_items(text,int),public.hq_update_work_item(uuid,text),public.hq_get_morning_brief() from public,anon;
grant execute on function public.hq_route_work_items(),public.hq_list_departments(),public.hq_list_work_items(text,int),public.hq_update_work_item(uuid,text),public.hq_get_morning_brief() to authenticated;
