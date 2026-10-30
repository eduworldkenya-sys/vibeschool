-- Existing visitor table denies anon and authenticated roles. Server access is explicitly granted.
grant select, insert on table public.hq_visitor_events to service_role;
grant usage, select on sequence public.hq_visitor_events_id_seq to service_role;
