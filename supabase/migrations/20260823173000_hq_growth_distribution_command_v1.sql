-- HQ Growth & Distribution Command v1.
-- Extends the canonical HQ marketing model; does not create a parallel business authority plane.
-- access: owner-only public.hq_growth_agents
-- authorization-test: public.hq_growth_agents denies public/anon and requires platform-owner authorization for authenticated access.
-- access: owner-only public.hq_growth_creators
-- authorization-test: public.hq_growth_creators denies public/anon and requires platform-owner authorization for authenticated access.
-- access: owner-only public.hq_growth_attributions
-- authorization-test: public.hq_growth_attributions denies public/anon and requires platform-owner authorization for authenticated access.
-- access: owner-only public.hq_growth_school_pipeline
-- authorization-test: public.hq_growth_school_pipeline denies public/anon and requires platform-owner authorization for authenticated access.
-- access: owner-rpc public.hq_growth_command_overview
-- authorization-test: public.hq_growth_command_overview rejects unauthenticated and non-owner callers before reading business data.

begin;

alter table public.hq_marketing_campaigns
  add column if not exists campaign_code text,
  add column if not exists campaign_type text,
  add column if not exists source_key text,
  add column if not exists territory text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists hq_marketing_campaigns_campaign_code_uq on public.hq_marketing_campaigns(campaign_code) where campaign_code is not null;

alter table public.hq_marketing_events add column if not exists value_kes numeric, add column if not exists attribution_code text;

create table if not exists public.hq_growth_agents (
  id uuid primary key default gen_random_uuid(), agent_code text not null unique,
  user_id uuid references auth.users(id) on delete set null, display_name text not null, territory text not null,
  schools_assigned integer not null default 0 check (schools_assigned >= 0),
  commission_rate numeric not null default 0 check (commission_rate >= 0 and commission_rate <= 1),
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.hq_growth_creators (
  id uuid primary key default gen_random_uuid(), creator_code text not null unique,
  platform text not null check (platform in ('tiktok','instagram','youtube','other')), handle text not null, display_name text not null,
  commission_rate numeric not null default 0 check (commission_rate >= 0 and commission_rate <= 1),
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.hq_growth_attributions (
  id uuid primary key default gen_random_uuid(), visitor_id uuid, profile_id uuid references public.profiles(id) on delete set null,
  campaign_id uuid references public.hq_marketing_campaigns(id) on delete set null,
  agent_id uuid references public.hq_growth_agents(id) on delete set null,
  creator_id uuid references public.hq_growth_creators(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  source_key text not null, attribution_code text, first_touch_at timestamptz not null default now(), signup_at timestamptz,
  activated_at timestamptz, returned_day2_at timestamptz, first_payment_at timestamptz,
  revenue_kes numeric not null default 0 check (revenue_kes >= 0), metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.hq_growth_school_pipeline (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  stage text not null default 'target' check (stage in ('target','contacted','students_using','teacher_champion','active','paying','institutional_prospect','school_customer')),
  assigned_agent_id uuid references public.hq_growth_agents(id) on delete set null,
  teacher_champion_profile_id uuid references public.profiles(id) on delete set null, territory text,
  first_student_at timestamptz, first_payment_at timestamptz, institutional_proposal_sent_at timestamptz,
  institutional_contract_signed_at timestamptz, notes text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (school_id)
);

create index if not exists hq_growth_attributions_campaign_idx on public.hq_growth_attributions(campaign_id, first_touch_at desc);
create index if not exists hq_growth_attributions_source_idx on public.hq_growth_attributions(source_key, first_touch_at desc);
create index if not exists hq_growth_attributions_agent_idx on public.hq_growth_attributions(agent_id, first_touch_at desc);
create index if not exists hq_growth_attributions_creator_idx on public.hq_growth_attributions(creator_id, first_touch_at desc);
create index if not exists hq_growth_attributions_school_idx on public.hq_growth_attributions(school_id, first_touch_at desc);
create index if not exists hq_growth_school_pipeline_stage_idx on public.hq_growth_school_pipeline(stage, updated_at desc);

alter table public.hq_growth_agents enable row level security;
alter table public.hq_growth_creators enable row level security;
alter table public.hq_growth_attributions enable row level security;
alter table public.hq_growth_school_pipeline enable row level security;

revoke all on public.hq_growth_agents, public.hq_growth_creators, public.hq_growth_attributions, public.hq_growth_school_pipeline from public, anon;
grant select, insert, update, delete on public.hq_growth_agents, public.hq_growth_creators, public.hq_growth_attributions, public.hq_growth_school_pipeline to authenticated;

drop policy if exists hq_growth_agents_owner_only on public.hq_growth_agents;
create policy hq_growth_agents_owner_only on public.hq_growth_agents for all to authenticated using (coalesce(public.is_platform_owner(), false)) with check (coalesce(public.is_platform_owner(), false));
drop policy if exists hq_growth_creators_owner_only on public.hq_growth_creators;
create policy hq_growth_creators_owner_only on public.hq_growth_creators for all to authenticated using (coalesce(public.is_platform_owner(), false)) with check (coalesce(public.is_platform_owner(), false));
drop policy if exists hq_growth_attributions_owner_only on public.hq_growth_attributions;
create policy hq_growth_attributions_owner_only on public.hq_growth_attributions for all to authenticated using (coalesce(public.is_platform_owner(), false)) with check (coalesce(public.is_platform_owner(), false));
drop policy if exists hq_growth_school_pipeline_owner_only on public.hq_growth_school_pipeline;
create policy hq_growth_school_pipeline_owner_only on public.hq_growth_school_pipeline for all to authenticated using (coalesce(public.is_platform_owner(), false)) with check (coalesce(public.is_platform_owner(), false));

create or replace function public.hq_growth_command_overview(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
        v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(), false) then raise exception 'owner_authorization_required'; end if;
  return jsonb_build_object(
    'generated_at', now(), 'window_days', v_days,
    'summary', jsonb_build_object(
      'open_campaigns',(select count(*) from public.hq_marketing_campaigns where status not in ('completed','archived')),
      'active_campaigns',(select count(*) from public.hq_marketing_campaigns where status='active'),
      'touches',(select count(*) from public.hq_growth_attributions where first_touch_at>=v_since),
      'signups',(select count(*) from public.hq_growth_attributions where signup_at>=v_since),
      'activated',(select count(*) from public.hq_growth_attributions where activated_at>=v_since),
      'returned_day2',(select count(*) from public.hq_growth_attributions where returned_day2_at>=v_since),
      'paid',(select count(*) from public.hq_growth_attributions where first_payment_at>=v_since),
      'revenue_kes',(select coalesce(sum(revenue_kes),0) from public.hq_growth_attributions where first_payment_at>=v_since),
      'active_agents',(select count(*) from public.hq_growth_agents where status='active'),
      'active_creators',(select count(*) from public.hq_growth_creators where status='active'),
      'schools_in_pipeline',(select count(*) from public.hq_growth_school_pipeline),
      'school_customers',(select count(*) from public.hq_growth_school_pipeline where stage='school_customer')
    ),
    'sources',coalesce((select jsonb_agg(to_jsonb(x) order by x.paid desc,x.signups desc) from (
      select source_key as source,count(*) as touches,count(*) filter(where signup_at is not null) as signups,
      count(*) filter(where activated_at is not null) as activated,count(*) filter(where returned_day2_at is not null) as returned_day2,
      count(*) filter(where first_payment_at is not null) as paid,coalesce(sum(revenue_kes),0) as revenue_kes
      from public.hq_growth_attributions where first_touch_at>=v_since group by source_key) x),'[]'::jsonb),
    'campaigns',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select c.id,c.name,c.campaign_code,c.campaign_type,c.channel,c.source_key,c.territory,c.status,c.budget,c.currency,c.created_at,
      count(a.id) filter(where a.first_touch_at>=v_since) as touches,count(a.id) filter(where a.signup_at>=v_since) as signups,
      count(a.id) filter(where a.first_payment_at>=v_since) as paid,coalesce(sum(a.revenue_kes) filter(where a.first_payment_at>=v_since),0) as revenue_kes
      from public.hq_marketing_campaigns c left join public.hq_growth_attributions a on a.campaign_id=c.id group by c.id order by c.created_at desc limit 50) x),'[]'::jsonb),
    'agents',coalesce((select jsonb_agg(to_jsonb(x) order by x.paid desc,x.signups desc) from (
      select g.id,g.agent_code,g.display_name,g.territory,g.schools_assigned,g.commission_rate,g.status,
      count(a.id) filter(where a.signup_at>=v_since) as signups,count(a.id) filter(where a.activated_at>=v_since) as activated,
      count(a.id) filter(where a.first_payment_at>=v_since) as paid,coalesce(sum(a.revenue_kes) filter(where a.first_payment_at>=v_since),0) as revenue_kes
      from public.hq_growth_agents g left join public.hq_growth_attributions a on a.agent_id=g.id group by g.id) x),'[]'::jsonb),
    'creators',coalesce((select jsonb_agg(to_jsonb(x) order by x.paid desc,x.signups desc) from (
      select g.id,g.creator_code,g.display_name,g.platform,g.handle,g.commission_rate,g.status,
      count(a.id) filter(where a.signup_at>=v_since) as signups,count(a.id) filter(where a.first_payment_at>=v_since) as paid,
      coalesce(sum(a.revenue_kes) filter(where a.first_payment_at>=v_since),0) as revenue_kes
      from public.hq_growth_creators g left join public.hq_growth_attributions a on a.creator_id=g.id group by g.id) x),'[]'::jsonb),
    'schools',coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc) from (
      select p.id,p.school_id,s.name as school_name,p.stage,p.territory,p.assigned_agent_id,a.display_name as agent_name,p.updated_at
      from public.hq_growth_school_pipeline p join public.schools s on s.id=p.school_id left join public.hq_growth_agents a on a.id=p.assigned_agent_id
      order by p.updated_at desc limit 100) x),'[]'::jsonb)
  );
end;$$;

revoke all on function public.hq_growth_command_overview(integer) from public, anon;
grant execute on function public.hq_growth_command_overview(integer) to authenticated;
comment on function public.hq_growth_command_overview(integer) is 'Owner-authorized Growth & Distribution Command read model. Deterministic evidence only; no automated outreach, payments, commissions, publishing, or worker-runtime activation.';

commit;
