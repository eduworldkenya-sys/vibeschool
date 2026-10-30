alter table public.hq_visitor_events add column if not exists device text not null default 'Unknown' check (length(device) <= 20);
alter table public.hq_visitor_events add column if not exists referrer text not null default 'Direct' check (length(referrer) <= 100);
grant select, insert on public.hq_visitor_events to service_role;
